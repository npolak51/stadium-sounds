import type { AudioAssignment } from '../types'
import { getAudioBlob } from './audioStorage'

const PROGRESS_MS = 100
const SEGMENT_FADE_OUT_S = 1.2
const FADE_IN_TOTAL_S = 1.2
/** User Stop: fade duration (gain automation + wall-clock cleanup aligned to this). */
export const STOP_FADE_MS = 1500
const STOP_FADE_SECS = STOP_FADE_MS / 1000

const audioDebug = import.meta.env.DEV

function logPlaybackTiming(label: string, timings: Record<string, number>) {
  if (!audioDebug) return
  const parts = Object.entries(timings)
    .filter(([, v]) => typeof v === 'number' && v >= 0)
    .map(([k, v]) => `${k}: ${v.toFixed(1)}ms`)
  console.info(`[audio] ${label}`, Object.fromEntries(Object.entries(timings)), parts.join(' '))
}

/** In-memory cache for pre-loaded blobs. Avoids async load on play(), which breaks iOS user-gesture requirement. */
const blobCache = new Map<string, Blob>()

/** Decoded PCM for buffer playback (deterministic scheduling vs HTMLMediaElement). */
const bufferCache = new Map<string, AudioBuffer>()
/** In-flight decodes keyed by path. */
const decodePromises = new Map<string, Promise<AudioBuffer>>()

/** Clear the blob cache (e.g. when user clears all audio files). */
export function clearBlobCache(): void {
  blobCache.clear()
  bufferCache.clear()
  decodePromises.clear()
}

/** Pre-load blobs for given paths. Call when Game view mounts so play() can avoid cold IndexedDB on tap. */
export async function preloadBlobs(paths: string[]): Promise<void> {
  const unique = [...new Set(paths)].filter(Boolean)
  await Promise.all(
    unique.map(async (path) => {
      if (blobCache.has(path)) return
      const blob = await getAudioBlob(path)
      if (blob) blobCache.set(path, blob)
    })
  )
}

/**
 * Decode audio into AudioBuffers ahead of play for lower tap-to-sound latency and stable timing.
 * Safe after blobs exist; failures per file are swallowed so play can still retry.
 */
export async function preloadDecodedBuffers(paths: string[]): Promise<void> {
  const unique = [...new Set(paths)].filter(Boolean)
  await Promise.all(
    unique.map(async (path) => {
      try {
        await getDecodedBuffer(path)
      } catch {
        /* ignore — play() surfaces errors */
      }
    })
  )
}

/** Check if a path is already in the blob cache (for sync play on iOS). */
export function isBlobCached(path: string): boolean {
  return blobCache.has(path)
}

function getBlobForPlay(path: string): Blob | null {
  return blobCache.get(path) ?? null
}

let audioContext: AudioContext | null = null

let currentSource: AudioBufferSourceNode | null = null
let currentGainNode: GainNode | null = null
let currentBuffer: AudioBuffer | null = null
let currentAssignment: AudioAssignment | null = null
let playbackActive = false
/** Absolute file seconds when the current BufferSource began (playback head at play start). */
let fileTimeAtPlayStart = 0
/** AudioContext.currentTime when the current BufferSource's `when` fires. */
let playStartedAtCtxTime = 0
/** Saved position after user Pause (seconds in file). */
let pausedAtFileSeconds: number | null = null

let progressInterval: ReturnType<typeof setInterval> | null = null
let stopFadeCleanupTimer: ReturnType<typeof window.setTimeout> | null = null
let segmentFadeScheduled = false
let segmentFadeWatchInterval: ReturnType<typeof setInterval> | null = null

let globalVolume = 1

/** Next seek position (seconds in file) for sound effects with `soundEffectSegmentResume`. */
const segmentResumeCursorById = new Map<string, number>()
let segmentResumeEndPendingForId: string | null = null

let warmupDone = false

function isSegmentResumeAssignment(a: AudioAssignment | null): boolean {
  return (
    a != null &&
    a.purpose === 'Sound Effect' &&
    a.soundEffectSegmentResume === true
  )
}

function resolveSegmentResumeStartTime(a: AudioAssignment): number {
  const raw = segmentResumeCursorById.get(a.id)
  let t = raw !== undefined ? raw : a.startTime
  t = Math.max(a.startTime, Math.min(t, a.endTime))
  if (t >= a.endTime - 1e-3) {
    return a.startTime
  }
  return t
}

export function resetSoundEffectSegmentResume(assignmentId?: string): void {
  if (assignmentId == null) {
    segmentResumeCursorById.clear()
  } else {
    segmentResumeCursorById.delete(assignmentId)
  }
  segmentResumeEndPendingForId = null
  notify()
}

function snapshotSegmentResumeBeforeClear(): void {
  if (!isSegmentResumeAssignment(currentAssignment)) return
  const assignment = currentAssignment!
  const id = assignment.id

  if (segmentResumeEndPendingForId === id) {
    segmentResumeCursorById.set(id, assignment.startTime)
    segmentResumeEndPendingForId = null
    return
  }

  const t = pausedAtFileSeconds ?? getCurrentFileTimeInner()
  const st = assignment.startTime
  const en = assignment.endTime
  if (t >= en - 1e-3) {
    segmentResumeCursorById.set(id, st)
  } else if (t > st) {
    segmentResumeCursorById.set(id, t)
  }
}

function getOrCreateAudioContext(): AudioContext {
  if (!audioContext) {
    const AC =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) {
      throw new Error('Web Audio API is not available in this browser.')
    }
    audioContext = new AC()
  }
  return audioContext
}

export async function ensureContextRunning(): Promise<void> {
  const ctx = getOrCreateAudioContext()
  if (ctx.state === 'suspended') {
    await ctx.resume()
  }
}

/**
 * Runs AudioContext.resume() once on first gesture (pair with passive pointer listener).
 * Helps reduce first-play latency after home-screen launch.
 */
export async function warmupAudioContext(): Promise<void> {
  if (warmupDone) return
  warmupDone = true
  await ensureContextRunning()
  const ctx = getOrCreateAudioContext()
  /* Inaudible one-sample tick so the rendering graph is exercised once. */
  const buf = ctx.createBuffer(1, 1, ctx.sampleRate)
  const src = ctx.createBufferSource()
  const g = ctx.createGain()
  g.gain.value = 0
  src.buffer = buf
  src.connect(g).connect(ctx.destination)
  const t = ctx.currentTime
  src.start(t)
  src.stop(t + 0.001)
}

async function getDecodedBuffer(filePath: string): Promise<AudioBuffer> {
  const hit = bufferCache.get(filePath)
  if (hit) return hit
  let p = decodePromises.get(filePath)
  if (!p) {
    p = (async () => {
      let blob = getBlobForPlay(filePath)
      if (!blob) {
        blob = await getAudioBlob(filePath)
        if (blob) blobCache.set(filePath, blob)
      }
      if (!blob) {
        decodePromises.delete(filePath)
        throw new Error(`Audio file not found: ${filePath}`)
      }
      const ctx = getOrCreateAudioContext()
      const raw = await blob.arrayBuffer()
      const audioBuf = await ctx.decodeAudioData(raw.slice(0))
      bufferCache.set(filePath, audioBuf)
      decodePromises.delete(filePath)
      return audioBuf
    })()
    decodePromises.set(filePath, p)
  }
  return p
}

function disconnectPlaybackGraph(): void {
  try {
    currentSource?.stop(0)
  } catch {
    /* already stopped */
  }
  try {
    currentSource?.disconnect()
  } catch {
    /* ignore */
  }
  try {
    currentGainNode?.disconnect()
  } catch {
    /* ignore */
  }
  currentSource = null
  currentGainNode = null
  currentBuffer = null
  playbackActive = false
}

function currentOutputGain(): number {
  if (currentGainNode) {
    try {
      return currentGainNode.gain.value
    } catch {
      return globalVolume
    }
  }
  return globalVolume
}

/** Current playback head in the file (seconds), including during active BufferSource playback. */
function getCurrentFileTimeInner(): number {
  const ctx = audioContext
  if (!ctx || !currentBuffer || !currentAssignment) {
    return pausedAtFileSeconds ?? 0
  }
  if (playbackActive) {
    return fileTimeAtPlayStart + (ctx.currentTime - playStartedAtCtxTime)
  }
  if (pausedAtFileSeconds !== null) {
    return pausedAtFileSeconds
  }
  return currentAssignment.startTime
}

export type PlaybackState = {
  isPlaying: boolean
  currentTime: number
  remainingTime: number
  progress: number
  currentAssignment: AudioAssignment | null
  /** 0–1, Web Audio gain (iOS-safe) */
  volume: number
  fullDuration: number
  fullPosition: number
}

type Listener = (state: PlaybackState) => void
const listeners = new Set<Listener>()

function getState(): PlaybackState {
  if (!currentAssignment) {
    return {
      isPlaying: false,
      currentTime: 0,
      remainingTime: 0,
      progress: 0,
      currentAssignment: null,
      volume: globalVolume,
      fullDuration: 0,
      fullPosition: 0
    }
  }
  const pos = getCurrentFileTimeInner()
  const elapsed = Math.max(0, pos - currentAssignment.startTime)
  const total = currentAssignment.endTime - currentAssignment.startTime
  const remaining = Math.max(0, total - elapsed)
  const dur = currentBuffer ? currentBuffer.duration : 0
  return {
    isPlaying: playbackActive,
    currentTime: elapsed,
    remainingTime: remaining,
    progress: total > 0 ? Math.min(1, elapsed / total) : 0,
    currentAssignment,
    volume: currentOutputGain(),
    fullDuration: Number.isFinite(dur) ? dur : 0,
    fullPosition: Number.isFinite(pos) ? pos : 0
  }
}

function notify() {
  const state = getState()
  listeners.forEach(fn => fn(state))
}

export function subscribe(fn: Listener) {
  listeners.add(fn)
  fn(getState())
  return () => listeners.delete(fn)
}

function cancelStopFadeTimer(): void {
  if (stopFadeCleanupTimer != null) {
    clearTimeout(stopFadeCleanupTimer)
    stopFadeCleanupTimer = null
  }
}

function stopSegmentFadeWatch(): void {
  if (segmentFadeWatchInterval != null) {
    clearInterval(segmentFadeWatchInterval)
    segmentFadeWatchInterval = null
  }
}

function clearPlayback() {
  snapshotSegmentResumeBeforeClear()
  cancelStopFadeTimer()
  stopSegmentFadeWatch()
  segmentFadeScheduled = false
  if (progressInterval) {
    clearInterval(progressInterval)
    progressInterval = null
  }
  disconnectPlaybackGraph()
  pausedAtFileSeconds = null
  currentAssignment = null
  notify()
}

function stopCurrentSourceOnly(): void {
  try {
    currentSource?.stop(0)
  } catch {
    /* ignore */
  }
  try {
    currentSource?.disconnect()
  } catch {
    /* ignore */
  }
  try {
    currentGainNode?.disconnect()
  } catch {
    /* ignore */
  }
  currentSource = null
  currentGainNode = null
  playbackActive = false
}

/**
 * Start or resume buffer playback from `filePos` (seconds, within file).
 * `buffer` must be the decoded asset for `assignment.filePath`.
 */
function startBufferFromFilePosition(
  assignment: AudioAssignment,
  buffer: AudioBuffer,
  filePos: number,
  opts: { scheduleFadeIn: boolean }
): void {
  const ctx = getOrCreateAudioContext()
  stopCurrentSourceOnly()
  segmentFadeScheduled = false

  const st = assignment.startTime
  const en = assignment.endTime
  const startOffset = Math.max(st, Math.min(filePos, en))
  const playDuration = Math.max(0, en - startOffset)
  if (playDuration < 0.02) {
    clearPlayback()
    return
  }

  const source = ctx.createBufferSource()
  source.buffer = buffer
  const gain = ctx.createGain()
  currentGainNode = gain
  currentSource = source
  currentBuffer = buffer

  const when = ctx.currentTime + 0.005
  const initialGain = opts.scheduleFadeIn && assignment.fadeIn ? 0 : globalVolume
  gain.gain.value = initialGain
  source.connect(gain).connect(ctx.destination)

  source.start(when, startOffset, playDuration)

  playStartedAtCtxTime = when
  fileTimeAtPlayStart = startOffset

  if (opts.scheduleFadeIn && assignment.fadeIn) {
    gain.gain.cancelScheduledValues(when)
    gain.gain.setValueAtTime(0, when)
    gain.gain.linearRampToValueAtTime(globalVolume, when + FADE_IN_TOTAL_S)
  }

  playbackActive = true
  pausedAtFileSeconds = null

  source.onended = () => {
    if (currentSource === source) {
      clearPlayback()
    }
  }
}

/** Near assignment.endTime, fade gain to 0 over ~1.2s (respects volume changes earlier in playback). */
function startSegmentFadeWatch(assignment: AudioAssignment): void {
  stopSegmentFadeWatch()
  if (!assignment.fadeOut) return
  segmentFadeScheduled = false
  segmentFadeWatchInterval = window.setInterval(() => {
    if (!playbackActive || currentAssignment?.id !== assignment.id) {
      stopSegmentFadeWatch()
      return
    }
    const ft = getCurrentFileTimeInner()
    const timeUntilEnd = assignment.endTime - ft
    if (
      !segmentFadeScheduled &&
      timeUntilEnd <= SEGMENT_FADE_OUT_S + 0.06 &&
      timeUntilEnd > 0
    ) {
      segmentFadeScheduled = true
      if (isSegmentResumeAssignment(assignment)) {
        segmentResumeEndPendingForId = assignment.id
      }
      const ctx = getOrCreateAudioContext()
      const g = currentGainNode?.gain
      if (g) {
        const now = ctx.currentTime
        const cur = g.value
        g.cancelScheduledValues(now)
        g.setValueAtTime(cur, now)
        g.linearRampToValueAtTime(0, now + Math.min(timeUntilEnd, SEGMENT_FADE_OUT_S))
      }
    }
    if (timeUntilEnd <= -0.1) {
      stopSegmentFadeWatch()
    }
  }, 80)
}

export async function play(assignment: AudioAssignment): Promise<void> {
  const tPlay = performance.now()
  stop(true)
  const tAfterStop = performance.now()

  await ensureContextRunning()
  const tCtx = performance.now()

  let blob = getBlobForPlay(assignment.filePath)
  if (!blob) {
    blob = await getAudioBlob(assignment.filePath) ?? null
    if (blob) blobCache.set(assignment.filePath, blob)
  }
  if (!blob) {
    throw new Error(`Audio file not found: ${assignment.fileName}`)
  }

  const tBeforeDecode = performance.now()
  const buffer = await getDecodedBuffer(assignment.filePath)
  const tAfterDecode = performance.now()

  currentAssignment = assignment

  const filePos = isSegmentResumeAssignment(assignment)
    ? resolveSegmentResumeStartTime(assignment)
    : assignment.startTime

  startBufferFromFilePosition(assignment, buffer, filePos, { scheduleFadeIn: true })
  startSegmentFadeWatch(assignment)

  logPlaybackTiming('play', {
    stopMs: tAfterStop - tPlay,
    resumeContextMs: tCtx - tAfterStop,
    decodeMs: tAfterDecode - tBeforeDecode,
    totalMs: tAfterDecode - tPlay
  })

  progressInterval = setInterval(notify, PROGRESS_MS)
  notify()
}

export function pause() {
  if (!playbackActive || !currentAssignment || !currentBuffer) return
  stopSegmentFadeWatch()
  const pos = getCurrentFileTimeInner()
  stopCurrentSourceOnly()
  pausedAtFileSeconds = pos
  if (progressInterval) {
    clearInterval(progressInterval)
    progressInterval = null
  }
  notify()
}

export function resume() {
  if (!currentAssignment || !currentBuffer || pausedAtFileSeconds === null) return
  void (async () => {
    try {
      const t0 = performance.now()
      await ensureContextRunning()
      startBufferFromFilePosition(currentAssignment!, currentBuffer!, pausedAtFileSeconds, {
        scheduleFadeIn: false
      })
      startSegmentFadeWatch(currentAssignment!)
      logPlaybackTiming('resume', { totalMs: performance.now() - t0 })
      progressInterval = setInterval(notify, PROGRESS_MS)
      notify()
    } catch {
      notify()
    }
  })()
}

export function togglePlayPause() {
  if (!currentAssignment) return
  if (playbackActive) {
    pause()
  } else {
    resume()
  }
}

export function setVolume(level: number) {
  globalVolume = Math.max(0, Math.min(1, level))
  if (currentGainNode && playbackActive) {
    currentGainNode.gain.setValueAtTime(globalVolume, getOrCreateAudioContext().currentTime)
  } else if (currentGainNode) {
    currentGainNode.gain.value = globalVolume
  }
  notify()
}

export function stop(immediate = false) {
  if (!currentAssignment && !currentBuffer) return
  if (immediate) {
    clearPlayback()
    return
  }
  /** Paused: nothing routed to GainNode — stop clears UI state. */
  if (!playbackActive || !currentGainNode) {
    clearPlayback()
    return
  }
  stopSegmentFadeWatch()
  const ctx = getOrCreateAudioContext()
  const g = currentGainNode.gain
  const now = ctx.currentTime
  const cur = g.value
  cancelStopFadeTimer()
  g.cancelScheduledValues(now)
  g.setValueAtTime(cur, now)
  const t0 = performance.now()
  g.linearRampToValueAtTime(0, now + STOP_FADE_SECS)
  logPlaybackTiming('stopFadeStart', {
    rampDurationMs: STOP_FADE_MS
  })

  stopFadeCleanupTimer = window.setTimeout(() => {
    stopFadeCleanupTimer = null
    const t1 = performance.now()
    logPlaybackTiming('stopFadeCleanup', {
      elapsedWallMs: t1 - t0
    })
    clearPlayback()
  }, STOP_FADE_MS)
}

export function seekTo(progress: number) {
  if (!currentAssignment || !currentBuffer) return
  const total = currentAssignment.endTime - currentAssignment.startTime
  const newPos = currentAssignment.startTime + progress * total
  if (playbackActive && currentGainNode) {
    startBufferFromFilePosition(currentAssignment, currentBuffer, newPos, { scheduleFadeIn: false })
    startSegmentFadeWatch(currentAssignment)
  } else if (pausedAtFileSeconds !== null) {
    pausedAtFileSeconds = newPos
  }
  if (isSegmentResumeAssignment(currentAssignment)) {
    segmentResumeCursorById.set(currentAssignment.id, newPos)
  }
  notify()
}

export function seekToFullPosition(seconds: number) {
  if (!currentAssignment || !currentBuffer) return
  const max = currentBuffer.duration
  const t = Math.max(0, Math.min(seconds, max))
  if (playbackActive && currentGainNode) {
    startBufferFromFilePosition(currentAssignment, currentBuffer, t, { scheduleFadeIn: false })
    startSegmentFadeWatch(currentAssignment)
  } else if (pausedAtFileSeconds !== null) {
    pausedAtFileSeconds = t
  }
  notify()
}

/** Preview audio from a file path, start to end (in seconds). Stops any current playback. */
export async function previewPlay(
  filePath: string,
  startTime: number,
  endTime: number
): Promise<void> {
  const t0 = performance.now()
  stop(true)
  let blob = getBlobForPlay(filePath)
  if (!blob) {
    blob = await getAudioBlob(filePath) ?? null
    if (blob) blobCache.set(filePath, blob)
  }
  if (!blob) throw new Error('Audio file not found')

  await ensureContextRunning()
  const tBeforeDecode = performance.now()
  const buffer = await getDecodedBuffer(filePath)
  const tAfterDecode = performance.now()

  currentAssignment = {
    id: '',
    fileName: '',
    filePath,
    purpose: 'Sound Effect',
    startTime,
    endTime,
    duration: endTime - startTime,
    fadeIn: false,
    fadeOut: false
  }

  startBufferFromFilePosition(
    currentAssignment,
    buffer,
    startTime,
    { scheduleFadeIn: false }
  )

  logPlaybackTiming('previewPlay', {
    decodeMs: tAfterDecode - tBeforeDecode,
    totalMs: tAfterDecode - t0
  })

  progressInterval = setInterval(notify, PROGRESS_MS)
  notify()
}

export async function getAudioDuration(filePath: string): Promise<number> {
  const cached = bufferCache.get(filePath)
  if (cached) return cached.duration
  const blob = await getAudioBlob(filePath)
  if (!blob) return 0
  try {
    const buf = await getDecodedBuffer(filePath)
    return buf.duration
  } catch {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.addEventListener('loadedmetadata', () => {
        resolve(audio.duration)
        URL.revokeObjectURL(url)
      })
      audio.addEventListener('error', () => {
        resolve(0)
        URL.revokeObjectURL(url)
      })
    })
  }
}

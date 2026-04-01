import type { AudioAssignment } from '../types'
import { getAudioBlob } from './audioStorage'

/** In-memory cache for pre-loaded blobs. Avoids async load on play(), which breaks iOS user-gesture requirement. */
const blobCache = new Map<string, Blob>()

/** Clear the blob cache (e.g. when user clears all audio files). */
export function clearBlobCache(): void {
  blobCache.clear()
}

/** Pre-load blobs for given paths. Call when Game view mounts so play() can use cache synchronously on tap.
 * Returns true when all paths are cached (required for iPad - play() must run sync within user gesture). */
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

/** Check if a path is already in the blob cache (for sync play on iOS). */
export function isBlobCached(path: string): boolean {
  return blobCache.has(path)
}

function getBlobForPlay(path: string): Blob | null {
  return blobCache.get(path) ?? null
}

let currentAudio: HTMLAudioElement | null = null
let currentAssignment: AudioAssignment | null = null
let progressInterval: ReturnType<typeof setInterval> | null = null
let stopFadeInterval: ReturnType<typeof setInterval> | null = null
let fadeInInterval: ReturnType<typeof setInterval> | null = null
let fadeOutInterval: ReturnType<typeof setInterval> | null = null

export type PlaybackState = {
  isPlaying: boolean
  currentTime: number
  remainingTime: number
  progress: number
  currentAssignment: AudioAssignment | null
  /** 0–1, mirrors HTMLMediaElement.volume */
  volume: number
  /** Full file duration in seconds (for preview scrubber) */
  fullDuration: number
  /** Current position in full file in seconds (for preview scrubber) */
  fullPosition: number
}

type Listener = (state: PlaybackState) => void
const listeners = new Set<Listener>()

function getState(): PlaybackState {
  if (!currentAudio || !currentAssignment) {
    return {
      isPlaying: false,
      currentTime: 0,
      remainingTime: 0,
      progress: 0,
      currentAssignment: null,
      volume: 1,
      fullDuration: 0,
      fullPosition: 0
    }
  }
  const elapsed = Math.max(0, currentAudio.currentTime - currentAssignment.startTime)
  const total = currentAssignment.endTime - currentAssignment.startTime
  const remaining = Math.max(0, total - elapsed)
  const dur = currentAudio.duration
  const pos = currentAudio.currentTime
  return {
    isPlaying: !currentAudio.paused,
    currentTime: elapsed,
    remainingTime: remaining,
    progress: total > 0 ? Math.min(1, elapsed / total) : 0,
    currentAssignment,
    volume: currentAudio.volume,
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

function clearPlayback() {
  if (stopFadeInterval) {
    clearInterval(stopFadeInterval)
    stopFadeInterval = null
  }
  if (fadeInInterval) {
    clearInterval(fadeInInterval)
    fadeInInterval = null
  }
  if (fadeOutInterval) {
    clearInterval(fadeOutInterval)
    fadeOutInterval = null
  }
  if (progressInterval) {
    clearInterval(progressInterval)
    progressInterval = null
  }
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.src = ''
    currentAudio = null
  }
  currentAssignment = null
  notify()
}

export async function play(assignment: AudioAssignment): Promise<void> {
  stop(true)
  let blob = getBlobForPlay(assignment.filePath)
  if (!blob) {
    blob = await getAudioBlob(assignment.filePath) ?? null
    if (blob) blobCache.set(assignment.filePath, blob)
  }
  if (!blob) {
    throw new Error(`Audio file not found: ${assignment.fileName}`)
  }
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  currentAudio = audio
  currentAssignment = assignment

  audio.currentTime = assignment.startTime
  audio.volume = assignment.fadeIn ? 0 : 1

  if (assignment.fadeIn) {
    const fadeSteps = 25
    const fadeDuration = 1200
    const stepInterval = fadeDuration / fadeSteps
    let step = 0
    fadeInInterval = setInterval(() => {
      step++
      audio.volume = Math.min(1, step / fadeSteps)
      if (step >= fadeSteps && fadeInInterval) {
        clearInterval(fadeInInterval)
        fadeInInterval = null
      }
    }, stepInterval)
  }

  const handleEnd = () => {
    URL.revokeObjectURL(url)
    clearPlayback()
  }

  audio.addEventListener('ended', handleEnd)

  const startFadeOut = () => {
    if (fadeOutInterval || !assignment.fadeOut) return
    const startVolume = audio.volume
    const fadeSteps = 25
    const fadeDuration = 1200
    const stepInterval = fadeDuration / fadeSteps
    const volumeStep = startVolume / fadeSteps
    let step = 0
    fadeOutInterval = setInterval(() => {
      step++
      audio.volume = Math.max(0, startVolume - volumeStep * step)
      if (step >= fadeSteps && fadeOutInterval) {
        clearInterval(fadeOutInterval)
        fadeOutInterval = null
        audio.pause()
        handleEnd()
      }
    }, stepInterval)
  }

  audio.addEventListener('timeupdate', () => {
    const timeUntilEnd = assignment.endTime - audio.currentTime
    if (assignment.fadeOut && timeUntilEnd <= 1.2 && !fadeOutInterval) {
      startFadeOut()
    } else if (!assignment.fadeOut && audio.currentTime >= assignment.endTime) {
      audio.pause()
      handleEnd()
    }
  })

  try {
    await audio.play()
  } catch (e) {
    clearPlayback()
    throw new Error(
      'Playback was blocked. On iPad/iPhone, tap the item again to play, or ensure audio is unlocked.'
    )
  }
  progressInterval = setInterval(notify, 100)
  notify()
}

export function pause() {
  if (currentAudio) {
    currentAudio.pause()
    if (progressInterval) {
      clearInterval(progressInterval)
      progressInterval = null
    }
    notify()
  }
}

export function resume() {
  if (currentAudio) {
    currentAudio.play()
    progressInterval = setInterval(notify, 100)
    notify()
  }
}

export function togglePlayPause() {
  if (!currentAudio) return
  if (currentAudio.paused) {
    resume()
  } else {
    pause()
  }
}

export function setVolume(level: number) {
  if (!currentAudio) return
  currentAudio.volume = Math.max(0, Math.min(1, level))
  notify()
}

export function stop(immediate = false) {
  if (!currentAudio) return
  if (immediate) {
    clearPlayback()
    return
  }
  const audio = currentAudio
  const startVolume = audio.volume
  const fadeDuration = 1500 // ms — fade to silence, slider tracks audio.volume
  const steps = 30
  const stepInterval = fadeDuration / steps
  const volumeStep = startVolume / steps
  let step = 0
  if (stopFadeInterval) clearInterval(stopFadeInterval)
  stopFadeInterval = setInterval(() => {
    step++
    audio.volume = Math.max(0, startVolume - volumeStep * step)
    notify()
    if (step >= steps) {
      if (stopFadeInterval) clearInterval(stopFadeInterval)
      stopFadeInterval = null
      clearPlayback()
    }
  }, stepInterval)
}

export function seekTo(progress: number) {
  if (!currentAudio || !currentAssignment) return
  const total = currentAssignment.endTime - currentAssignment.startTime
  currentAudio.currentTime = currentAssignment.startTime + progress * total
  notify()
}

/** Seek to absolute position in the full file (seconds). Used for preview scrubber. */
export function seekToFullPosition(seconds: number) {
  if (!currentAudio) return
  currentAudio.currentTime = Math.max(0, Math.min(seconds, currentAudio.duration || seconds))
  notify()
}

/** Preview audio from a file path, start to end (in seconds). Stops any current playback. */
export async function previewPlay(
  filePath: string,
  startTime: number,
  endTime: number
): Promise<void> {
  stop(true)
  let blob = getBlobForPlay(filePath)
  if (!blob) {
    blob = await getAudioBlob(filePath) ?? null
    if (blob) blobCache.set(filePath, blob)
  }
  if (!blob) throw new Error('Audio file not found')
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  currentAudio = audio
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

  audio.currentTime = startTime
  audio.volume = 1

  const handleEnd = () => {
    URL.revokeObjectURL(url)
    clearPlayback()
  }

  audio.addEventListener('timeupdate', () => {
    if (audio.currentTime >= endTime) {
      audio.pause()
      handleEnd()
    }
  })

  try {
    await audio.play()
  } catch (e) {
    clearPlayback()
    throw new Error(
      'Preview was blocked. On iPad/iPhone, tap Preview again to play.'
    )
  }
  progressInterval = setInterval(notify, 100)
  notify()
}

/** Get duration of an audio file in seconds */
export async function getAudioDuration(filePath: string): Promise<number> {
  const blob = await getAudioBlob(filePath)
  if (!blob) return 0
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

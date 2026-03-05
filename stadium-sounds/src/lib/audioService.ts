import type { AudioAssignment } from '../types'
import { getAudioBlob } from './audioStorage'

let currentAudio: HTMLAudioElement | null = null
let currentAssignment: AudioAssignment | null = null
let progressInterval: ReturnType<typeof setInterval> | null = null

export type PlaybackState = {
  isPlaying: boolean
  currentTime: number
  remainingTime: number
  progress: number
  currentAssignment: AudioAssignment | null
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
      currentAssignment: null
    }
  }
  const elapsed = Math.max(0, currentAudio.currentTime - currentAssignment.startTime)
  const total = currentAssignment.endTime - currentAssignment.startTime
  const remaining = Math.max(0, total - elapsed)
  return {
    isPlaying: !currentAudio.paused,
    currentTime: elapsed,
    remainingTime: remaining,
    progress: total > 0 ? Math.min(1, elapsed / total) : 0,
    currentAssignment
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
  stop()
  const blob = await getAudioBlob(assignment.filePath)
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
    const fadeSteps = 20
    const fadeDuration = 1000
    const stepInterval = fadeDuration / fadeSteps
    let step = 0
    const fadeInterval = setInterval(() => {
      step++
      audio.volume = Math.min(1, (step / fadeSteps))
      if (step >= fadeSteps) clearInterval(fadeInterval)
    }, stepInterval)
  }

  const handleEnd = () => {
    URL.revokeObjectURL(url)
    clearPlayback()
  }

  audio.addEventListener('ended', () => {
    if (assignment.fadeOut) {
      // Fade out handled via progress check
    }
    handleEnd()
  })

  audio.addEventListener('timeupdate', () => {
    const timeUntilEnd = assignment.endTime - audio.currentTime
    if (assignment.fadeOut && timeUntilEnd <= 1 && timeUntilEnd > 0) {
      audio.volume = Math.max(0, audio.volume - 0.05)
    }
    if (audio.currentTime >= assignment.endTime) {
      audio.pause()
      handleEnd()
    }
  })

  await audio.play()
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

export function stop() {
  if (currentAudio && currentAssignment?.fadeOut) {
    const fadeOut = () => {
      currentAudio!.volume = Math.max(0, currentAudio!.volume - 0.1)
      if (currentAudio!.volume > 0) {
        requestAnimationFrame(fadeOut)
      } else {
        clearPlayback()
      }
    }
    fadeOut()
  } else {
    clearPlayback()
  }
}

export function seekTo(progress: number) {
  if (!currentAudio || !currentAssignment) return
  const total = currentAssignment.endTime - currentAssignment.startTime
  currentAudio.currentTime = currentAssignment.startTime + progress * total
  notify()
}

/** Preview audio from a file path, start to end (in seconds). Stops any current playback. */
export async function previewPlay(
  filePath: string,
  startTime: number,
  endTime: number
): Promise<void> {
  stop()
  const blob = await getAudioBlob(filePath)
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

  await audio.play()
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

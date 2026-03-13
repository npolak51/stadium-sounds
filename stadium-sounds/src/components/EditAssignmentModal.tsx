import { useState, useEffect } from 'react'
import { previewPlay, getAudioDuration, subscribe, seekToFullPosition, preloadBlobs } from '../lib/audioService'
import TimeInput from './TimeInput'
import PreviewTimeBar from './PreviewTimeBar'
import type { AudioAssignment, SoundEffectCategory } from '../types'
import './EditAssignmentModal.css'

const SOUND_CATEGORIES: SoundEffectCategory[] = ['Pre/Postgame', 'Offense', 'Defense']

interface EditAssignmentModalProps {
  assignment: AudioAssignment
  onSave: (assignment: AudioAssignment) => void
  onClose: () => void
}

export default function EditAssignmentModal({ assignment, onSave, onClose }: EditAssignmentModalProps) {
  const [startTime, setStartTime] = useState(assignment.startTime)
  const [endTime, setEndTime] = useState(assignment.endTime)
  const [duration, setDuration] = useState(assignment.duration)
  const [fadeIn, setFadeIn] = useState(assignment.fadeIn)
  const [fadeOut, setFadeOut] = useState(assignment.fadeOut)
  const [soundEffectName, setSoundEffectName] = useState(assignment.soundEffectName ?? '')
  const [soundCategory, setSoundCategory] = useState<SoundEffectCategory>(
    assignment.soundEffectCategory ?? 'Pre/Postgame'
  )
  const [fileDuration, setFileDuration] = useState<number | null>(null)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [playbackPosition, setPlaybackPosition] = useState<number | null>(null)

  useEffect(() => {
    const unsub = subscribe(state => {
      const isOurPreview = state.currentAssignment?.filePath === assignment.filePath
      setPlaybackPosition(isOurPreview ? state.fullPosition : null)
    })
    return () => {
      unsub()
    }
  }, [assignment.filePath])

  useEffect(() => {
    getAudioDuration(assignment.filePath).then(setFileDuration)
    preloadBlobs([assignment.filePath])
  }, [assignment.filePath])

  const handleSave = () => {
    const fallbackDur =
      assignment.purpose === 'In-Game Playlist' && fileDuration != null && fileDuration > 0
        ? fileDuration
        : assignment.duration || 60
    const end = endTime > startTime ? endTime : startTime + Math.max(1, fallbackDur)
    const updated: AudioAssignment = {
      ...assignment,
      startTime,
      endTime: end,
      duration: end - startTime,
      fadeIn,
      fadeOut,
      soundEffectCategory: assignment.purpose === 'Sound Effect' ? soundCategory : assignment.soundEffectCategory,
      soundEffectName:
        assignment.purpose === 'Sound Effect' ? (soundEffectName.trim() || undefined) : assignment.soundEffectName
    }
    onSave(updated)
    onClose()
  }

  const displayName =
    assignment.purpose === 'Sound Effect' && assignment.soundEffectName
      ? assignment.soundEffectName
      : assignment.fileName.replace(/\.[^/.]+$/, '')

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal edit-assignment-modal" onClick={e => e.stopPropagation()}>
        <h3>Edit: {displayName}</h3>
        {assignment.purpose === 'Sound Effect' && (
          <>
            <label className="edit-modal-field">
              Sound effect name
              <input
                type="text"
                value={soundEffectName}
                onChange={e => setSoundEffectName(e.target.value)}
                className="input"
                placeholder={assignment.fileName.replace(/\.[^/.]+$/, '')}
              />
            </label>
            <label className="edit-modal-field">
              Category
              <select
                className="input"
                value={soundCategory}
                onChange={e => setSoundCategory(e.target.value as SoundEffectCategory)}
              >
                {SOUND_CATEGORIES.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {fileDuration != null && fileDuration > 0 && (
          <PreviewTimeBar
            fileDuration={fileDuration}
            startTime={startTime}
            endTime={endTime}
            currentPosition={playbackPosition}
            onSeek={seconds => {
              seekToFullPosition(seconds)
              setStartTime(seconds)
              setEndTime(seconds + duration)
            }}
          />
        )}
        <div className="time-inputs-row">
          <TimeInput
            label="Start"
            value={startTime}
            onChange={v => {
              setStartTime(v)
              setEndTime(v + duration)
            }}
            max={fileDuration ?? 5999}
          />
          <TimeInput
            label="End"
            value={endTime}
            onChange={v => {
              setEndTime(v)
              setDuration(Math.max(0, v - startTime))
            }}
            min={startTime}
            max={fileDuration ?? 5999}
          />
          <TimeInput
            label="Duration"
            value={duration}
            onChange={v => {
              setDuration(v)
              setEndTime(startTime + v)
            }}
            min={0.1}
            max={(fileDuration ?? 5999) - startTime}
          />
        </div>
        <label className="edit-modal-checkbox">
          <input type="checkbox" checked={fadeIn} onChange={e => setFadeIn(e.target.checked)} />
          Fade in
        </label>
        <label className="edit-modal-checkbox">
          <input type="checkbox" checked={fadeOut} onChange={e => setFadeOut(e.target.checked)} />
          Fade out
        </label>
        <button
          type="button"
          className="btn-secondary"
          onClick={async () => {
            setIsPreviewing(true)
            try {
              await previewPlay(assignment.filePath, startTime, endTime)
            } catch (e) {
              console.error(e)
            } finally {
              setIsPreviewing(false)
            }
          }}
          disabled={isPreviewing}
        >
          {isPreviewing ? 'Playing…' : 'Preview'}
        </button>
        <div className="modal-actions">
          <button type="button" className="btn-primary" onClick={handleSave}>
            Save
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

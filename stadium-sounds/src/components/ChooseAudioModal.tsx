import { useState, useEffect } from 'react'
import { getAllStoredFiles } from '../lib/audioStorage'
import { previewPlay, getAudioDuration } from '../lib/audioService'
import TimeInput from './TimeInput'
import type { AudioAssignment } from '../types'
import './ChooseAudioModal.css'

function generateId() {
  return crypto.randomUUID()
}

interface ChooseAudioModalProps {
  playerId: string
  onSave: (assignment: AudioAssignment) => void
  onClose: () => void
}

export default function ChooseAudioModal({ playerId, onSave, onClose }: ChooseAudioModalProps) {
  const [storedFiles, setStoredFiles] = useState<{ path: string; fileName: string }[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(12)
  const [duration, setDuration] = useState(12)
  const [fileDuration, setFileDuration] = useState<number | null>(null)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [fadeIn, setFadeIn] = useState(false)
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    getAllStoredFiles().then(setStoredFiles)
  }, [])

  useEffect(() => {
    if (!selectedFile) {
      setFileDuration(null)
      return
    }
    getAudioDuration(selectedFile).then(setFileDuration)
  }, [selectedFile])

  useEffect(() => {
    if (!selectedFile) return
    const dur = fileDuration ?? 60
    setStartTime(0)
    setDuration(Math.floor(dur))
    setEndTime(Math.floor(dur))
  }, [selectedFile, fileDuration])

  const handleSave = () => {
    if (!selectedFile) return
    const fileInfo = storedFiles.find(f => f.path === selectedFile)
    const fileName = fileInfo?.fileName ?? selectedFile.split('_').slice(1).join('_')
    const end = endTime > startTime ? endTime : startTime + 60
    const assignment: AudioAssignment = {
      id: generateId(),
      fileName,
      filePath: selectedFile,
      purpose: 'Player Music',
      startTime,
      endTime: end,
      duration: end - startTime,
      fadeIn,
      fadeOut,
      player: playerId
    }
    onSave(assignment)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal choose-audio-modal" onClick={e => e.stopPropagation()}>
        <h3>Choose Audio</h3>
        <select
          className="input"
          value={selectedFile || ''}
          onChange={e => setSelectedFile(e.target.value || null)}
        >
          <option value="">Select file...</option>
          {storedFiles.length === 0 ? (
            <option disabled>Import files in Audio tab first</option>
          ) : (
            storedFiles.map(({ path, fileName }) => (
              <option key={path} value={path}>
                {fileName}
              </option>
            ))
          )}
        </select>
        {selectedFile && (
          <>
            <div className="time-inputs-row">
              <TimeInput
                label="Start"
                value={startTime}
                onChange={(v) => {
                  setStartTime(v)
                  setEndTime(v + duration)
                }}
                max={fileDuration ?? 5999}
              />
              <TimeInput
                label="End"
                value={endTime}
                onChange={(v) => {
                  setEndTime(v)
                  setDuration(Math.max(0, v - startTime))
                }}
                min={startTime}
                max={fileDuration ?? 5999}
              />
              <TimeInput
                label="Duration"
                value={duration}
                onChange={(v) => {
                  setDuration(v)
                  setEndTime(startTime + v)
                }}
                min={1}
                max={(fileDuration ?? 5999) - startTime}
              />
            </div>
            <label>
              <input type="checkbox" checked={fadeIn} onChange={e => setFadeIn(e.target.checked)} />
              Fade in
            </label>
            <label>
              <input type="checkbox" checked={fadeOut} onChange={e => setFadeOut(e.target.checked)} />
              Fade out
            </label>
            <button
              type="button"
              className="btn-secondary"
              onClick={async () => {
                if (!selectedFile) return
                setIsPreviewing(true)
                try {
                  await previewPlay(selectedFile, startTime, endTime)
                } catch (e) {
                  console.error(e)
                } finally {
                  setIsPreviewing(false)
                }
              }}
              disabled={!selectedFile || isPreviewing}
            >
              {isPreviewing ? 'Playing…' : 'Preview Audio'}
            </button>
          </>
        )}
        <div className="modal-actions">
          <button className="btn-primary" onClick={handleSave} disabled={!selectedFile}>
            Save
          </button>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

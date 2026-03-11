import { useState, useEffect, useRef } from 'react'
import { getAllStoredFiles, storeAudioFile } from '../lib/audioStorage'
import { previewPlay, getAudioDuration, subscribe, seekToFullPosition, preloadBlobs } from '../lib/audioService'
import TimeInput from './TimeInput'
import PreviewTimeBar from './PreviewTimeBar'
import type { AudioAssignment } from '../types'
import './ChooseAudioModal.css'

function generateId() {
  return crypto.randomUUID()
}

interface ChooseAudioModalProps {
  playerId: string
  onSave: (assignment: AudioAssignment) => void
  onClose: () => void
  onFilesChange?: () => void
}

export default function ChooseAudioModal({ playerId, onSave, onClose, onFilesChange }: ChooseAudioModalProps) {
  const [storedFiles, setStoredFiles] = useState<{ path: string; fileName: string }[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(12)
  const [duration, setDuration] = useState(12)
  const [fileDuration, setFileDuration] = useState<number | null>(null)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [fadeIn, setFadeIn] = useState(false)
  const [fadeOut, setFadeOut] = useState(false)
  const [playbackPosition, setPlaybackPosition] = useState<number | null>(null)

  useEffect(() => {
    const unsub = subscribe((state) => {
      const isOurPreview = state.currentAssignment?.filePath === selectedFile
      setPlaybackPosition(isOurPreview ? state.fullPosition : null)
    })
    return () => { unsub() }
  }, [selectedFile])

  const loadStoredFiles = () => {
    getAllStoredFiles().then(setStoredFiles)
  }

  useEffect(() => {
    loadStoredFiles()
  }, [])

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    const file = files[0]
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['mp3', 'm4a', 'wav', 'aac', 'flac', 'ogg', 'mp4'].includes(ext || '')) return
    const path = `${generateId()}_${file.name}`
    const { stored } = await storeAudioFile(path, file, file.name)
    if (stored) {
      loadStoredFiles()
      setSelectedFile(path)
      onFilesChange?.()
    }
    e.target.value = ''
  }

  useEffect(() => {
    if (!selectedFile) {
      setFileDuration(null)
      return
    }
    getAudioDuration(selectedFile).then(setFileDuration)
    preloadBlobs([selectedFile])
  }, [selectedFile])

  useEffect(() => {
    if (!selectedFile) return
    setStartTime(0)
    setDuration(12)
    setEndTime(12)
  }, [selectedFile])

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
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,.m4a,.wav,.aac,.flac,.ogg,.mp4"
          onChange={handleImportFile}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          className="btn-primary"
          onClick={() => fileInputRef.current?.click()}
        >
          Import Audio File
        </button>
        {storedFiles.length > 0 && (
          <select
            className="input"
            value={selectedFile || ''}
            onChange={e => setSelectedFile(e.target.value || null)}
          >
            <option value="">Or select existing file...</option>
            {storedFiles.map(({ path, fileName }) => (
              <option key={path} value={path}>
                {fileName}
              </option>
            ))}
          </select>
        )}
        {selectedFile && (
          <>
            {fileDuration != null && fileDuration > 0 && (
              <PreviewTimeBar
                fileDuration={fileDuration}
                startTime={startTime}
                endTime={endTime}
                currentPosition={playbackPosition}
                onSeek={(seconds) => {
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
                min={0.1}
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

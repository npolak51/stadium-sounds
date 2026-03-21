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
  purpose: 'Player Music' | 'Pitcher Entrance'
  initialAssignment?: AudioAssignment | null
  onSave: (assignment: AudioAssignment) => void
  onClose: () => void
  onFilesChange?: () => void
}

const DEFAULT_DURATION = 15

const MODAL_TITLES: Record<'Player Music' | 'Pitcher Entrance', { choose: string; edit: string }> = {
  'Player Music': { choose: 'Choose Walkup Music', edit: 'Edit Walkup Music' },
  'Pitcher Entrance': { choose: 'Choose Pitcher Entrance', edit: 'Edit Pitcher Entrance' }
}

export default function ChooseAudioModal({
  playerId,
  purpose,
  initialAssignment,
  onSave,
  onClose,
  onFilesChange
}: ChooseAudioModalProps) {
  const [storedFiles, setStoredFiles] = useState<{ path: string; fileName: string }[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(initialAssignment?.filePath ?? null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [startTime, setStartTime] = useState(initialAssignment?.startTime ?? 0)
  const [endTime, setEndTime] = useState(initialAssignment?.endTime ?? DEFAULT_DURATION)
  const [duration, setDuration] = useState(initialAssignment?.duration ?? DEFAULT_DURATION)
  const [fileDuration, setFileDuration] = useState<number | null>(null)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [fadeIn, setFadeIn] = useState(initialAssignment?.fadeIn ?? false)
  const [fadeOut, setFadeOut] = useState(initialAssignment?.fadeOut ?? false)
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
    if (!initialAssignment || selectedFile !== initialAssignment.filePath) {
      setStartTime(0)
      if (purpose === 'Pitcher Entrance' && fileDuration != null && fileDuration > 0) {
        setDuration(fileDuration)
        setEndTime(fileDuration)
      } else {
        setDuration(DEFAULT_DURATION)
        setEndTime(DEFAULT_DURATION)
      }
    }
  }, [selectedFile, initialAssignment, purpose, fileDuration])

  const handleSave = () => {
    if (!selectedFile) return
    const fileInfo = storedFiles.find(f => f.path === selectedFile)
    const fileName = fileInfo?.fileName ?? selectedFile.split('_').slice(1).join('_')
    const fallbackDur = purpose === 'Pitcher Entrance' ? (fileDuration ?? 0) : 60
    const end = endTime > startTime ? endTime : startTime + Math.max(1, fallbackDur)
    const assignment: AudioAssignment = {
      ...(initialAssignment ?? {}),
      id: initialAssignment?.id ?? generateId(),
      fileName,
      filePath: selectedFile,
      purpose,
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
        <h3>{initialAssignment ? MODAL_TITLES[purpose].edit : MODAL_TITLES[purpose].choose}</h3>
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

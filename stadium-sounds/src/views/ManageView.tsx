import { useState, useRef, useEffect } from 'react'
import { useAppData } from '../context/AppDataContext'
import { storeAudioFile, getStorageUsage, getAllStoredFiles, clearAllAudioFiles } from '../lib/audioStorage'
import { previewPlay, getAudioDuration } from '../lib/audioService'
import TimeInput from '../components/TimeInput'
import ChooseAudioModal from '../components/ChooseAudioModal'
import type { Player, AudioAssignment, SoundEffectCategory, PurposeType, TeamType } from '../types'
import './ManageView.css'

type ManageTab = 'players' | 'audio'

const SOUND_CATEGORIES: SoundEffectCategory[] = ['Pre/Postgame', 'Offense', 'Defense']
const TEAMS: TeamType[] = ['Varsity', 'JV Blue', 'JV Gold']

function generateId() {
  return crypto.randomUUID()
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function ManageView() {
  const [tab, setTab] = useState<ManageTab>('players')

  const {
    players,
    assignments,
    addPlayer,
    updatePlayer,
    removePlayer,
    addAssignment,
    removeAssignment,
    setPlaylistOrder,
    exportConfiguration,
    importConfiguration
  } = useAppData()

  const [chooseAudioPlayerId, setChooseAudioPlayerId] = useState<string | null>(null)

  const [storageInfo, setStorageInfo] = useState<{ used: number; fileCount: number } | null>(null)
  const [uploadFeedback, setUploadFeedback] = useState<{
    uploaded: number
    skipped: number
  } | null>(null)

  const showUploadFeedback = (uploaded: number, skipped: number) => {
    if (uploaded > 0 || skipped > 0) {
      setUploadFeedback({ uploaded, skipped })
      setTimeout(() => setUploadFeedback(null), 4000)
    }
  }

  const loadStorageInfo = async () => {
    const info = await getStorageUsage()
    setStorageInfo(info)
  }

  const handleSavePlayerAudio = (assignment: AudioAssignment) => {
    const existing = assignments.find(a => a.purpose === 'Player Music' && a.player === assignment.player)
    if (existing) removeAssignment(existing)
    addAssignment(assignment)
    setChooseAudioPlayerId(null)
  }

  return (
    <div className="manage-view">
      {uploadFeedback && (
        <div
          className={`upload-toast ${
            uploadFeedback.uploaded === 0 && uploadFeedback.skipped > 0
              ? 'upload-toast-skipped'
              : uploadFeedback.skipped > 0
                ? 'upload-toast-mixed'
                : ''
          }`}
          role="status"
        >
          <span className="upload-toast-icon">✓</span>
          {uploadFeedback.uploaded > 0 && (
            <span>
              {uploadFeedback.uploaded === 1
                ? '1 file uploaded'
                : `${uploadFeedback.uploaded} files uploaded`}
            </span>
          )}
          {uploadFeedback.uploaded > 0 && uploadFeedback.skipped > 0 && ' · '}
          {uploadFeedback.skipped > 0 && (
            <span>
              {uploadFeedback.skipped === 1
                ? '1 duplicate skipped'
                : `${uploadFeedback.skipped} duplicates skipped`}
            </span>
          )}
        </div>
      )}
      <div className="manage-tabs">
        {(['players', 'audio'] as const).map(t => (
          <button
            key={t}
            className={`manage-tab ${tab === t ? 'active' : ''}`}
            onClick={() => {
              setTab(t)
              if (t === 'audio') loadStorageInfo()
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'players' && (
        <PlayersTab
          players={players}
          assignments={assignments}
          addPlayer={addPlayer}
          updatePlayer={updatePlayer}
          removePlayer={removePlayer}
          onChooseAudio={setChooseAudioPlayerId}
        />
      )}

      {chooseAudioPlayerId && (
        <ChooseAudioModal
          playerId={chooseAudioPlayerId}
          onSave={handleSavePlayerAudio}
          onClose={() => setChooseAudioPlayerId(null)}
        />
      )}

      {tab === 'audio' && (
        <AudioTab
          assignments={assignments}
          addAssignment={addAssignment}
          removeAssignment={removeAssignment}
          setPlaylistOrder={setPlaylistOrder}
          onFilesChange={loadStorageInfo}
          onUploadComplete={showUploadFeedback}
          storageInfo={storageInfo}
          exportConfiguration={exportConfiguration}
          importConfiguration={importConfiguration}
        />
      )}
    </div>
  )
}

function PlayersTab({
  players,
  assignments,
  addPlayer,
  updatePlayer,
  removePlayer,
  onChooseAudio
}: {
  players: Player[]
  assignments: AudioAssignment[]
  addPlayer: (name: string, number: string, team: TeamType) => void
  updatePlayer: (player: Player, name: string, number: string, team: TeamType) => void
  removePlayer: (player: Player) => void
  onChooseAudio: (playerId: string) => void
}) {
  const playerMusic = assignments.filter(a => a.purpose === 'Player Music')

  return (
    <section className="manage-section">
      <h2>Players</h2>
      <div className="players-table-wrap">
        <table className="players-table">
          <thead>
            <tr>
              <th>Jersey #</th>
              <th>Name</th>
              <th>Team</th>
              <th>Choose Audio</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {players.map(p => {
              const assignment = playerMusic.find(a => a.player === p.id)
              return (
                <tr key={p.id}>
                  <td>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="input input-small"
                      value={p.number}
                      onChange={e => updatePlayer(p, p.name, e.target.value.replace(/\D/g, ''), p.team)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="input"
                      value={p.name}
                      onChange={e => {
                        const value = e.target.value
                        const capitalized = value.replace(/(^\w|\s\w)/g, (c: string) => c.toUpperCase())
                        updatePlayer(p, capitalized, p.number, p.team)
                      }}
                      autoCapitalize="words"
                    />
                  </td>
                  <td>
                    <select
                      className="input"
                      value={p.team}
                      onChange={e => updatePlayer(p, p.name, p.number, e.target.value as TeamType)}
                    >
                      {TEAMS.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={assignment ? 'btn-primary btn-small' : 'btn-secondary btn-small'}
                      onClick={() => onChooseAudio(p.id)}
                    >
                      {assignment ? assignment.fileName.replace(/\.[^/.]+$/, '') : 'Choose Audio'}
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn-small danger"
                      onClick={() => removePlayer(p)}
                      aria-label="Delete"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="btn-primary"
        onClick={() => addPlayer('', '', 'Varsity')}
      >
        Add Player
      </button>
    </section>
  )
}

function AudioTab({
  assignments,
  addAssignment,
  removeAssignment,
  setPlaylistOrder,
  onFilesChange,
  onUploadComplete,
  storageInfo,
  exportConfiguration,
  importConfiguration
}: {
  assignments: AudioAssignment[]
  addAssignment: (a: AudioAssignment) => void
  removeAssignment: (a: AudioAssignment) => void
  setPlaylistOrder: (a: AudioAssignment) => void
  onFilesChange: () => void
  onUploadComplete?: (uploaded: number, skipped: number) => void
  storageInfo: { used: number; fileCount: number } | null
  exportConfiguration: () => string
  importConfiguration: (json: string) => void
}) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [purpose, setPurpose] = useState<PurposeType>('Sound Effect')
  const [soundCategory, setSoundCategory] = useState<SoundEffectCategory>('Pre/Postgame')
  const [soundEffectName, setSoundEffectName] = useState('')
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(12)
  const [duration, setDuration] = useState(12)
  const [fileDuration, setFileDuration] = useState<number | null>(null)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [fadeIn, setFadeIn] = useState(false)
  const [fadeOut, setFadeOut] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [storedFiles, setStoredFiles] = useState<{ path: string; fileName: string }[]>([])
  const importInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getAllStoredFiles().then(setStoredFiles)
  }, [assignments])

  useEffect(() => {
    if (purpose === 'Sound Effect' && selectedFile) {
      const fileInfo = storedFiles.find(f => f.path === selectedFile)
      const baseName = fileInfo?.fileName?.replace(/\.[^/.]+$/, '') ?? selectedFile.split('_').slice(1).join('_').replace(/\.[^/.]+$/, '')
      setSoundEffectName(baseName)
    }
  }, [purpose, selectedFile, storedFiles])

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

  const handleImportFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    let uploaded = 0
    let skipped = 0
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (!['mp3', 'm4a', 'wav', 'aac', 'flac', 'ogg', 'mp4'].includes(ext || '')) continue
      const path = `${generateId()}_${file.name}`
      const { stored } = await storeAudioFile(path, file, file.name)
      stored ? uploaded++ : skipped++
    }
    onUploadComplete?.(uploaded, skipped)
    getAllStoredFiles().then(setStoredFiles)
    onFilesChange()
    e.target.value = ''
  }

  const handleCreateAssignment = () => {
    if (!selectedFile) return
    const fileInfo = storedFiles.find(f => f.path === selectedFile)
    const fileName = fileInfo?.fileName ?? selectedFile.split('_').slice(1).join('_')
    const end = endTime > startTime ? endTime : startTime + 60
    const assignment: AudioAssignment = {
      id: generateId(),
      fileName,
      filePath: selectedFile,
      purpose,
      startTime,
      endTime: end,
      duration: end - startTime,
      fadeIn,
      fadeOut,
      player: undefined,
      soundEffectCategory: purpose === 'Sound Effect' ? soundCategory : undefined,
      soundEffectName: purpose === 'Sound Effect' ? soundEffectName.trim() || undefined : undefined,
      playlistOrder: purpose === 'In-Game Playlist' ? 0 : undefined
    }
    addAssignment(assignment)
    if (purpose === 'In-Game Playlist') setPlaylistOrder(assignment)
    setSelectedFile(null)
    setSoundEffectName('')
    setStartTime(0)
    setEndTime(12)
    setDuration(12)
  }

  const handleExport = () => {
    const json = exportConfiguration()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `stadium-sounds-config-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        importConfiguration(reader.result as string)
      } catch {
        alert('Invalid configuration file')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleClearAll = async () => {
    if (!confirm('Are you sure? This will permanently delete all audio files and remove all assignments (Sound Effects, Playlist, and Player Music).')) return
    for (const a of assignments) {
      removeAssignment(a)
    }
    await clearAllAudioFiles()
    setStoredFiles([])
    setSelectedFile(null)
    setSoundEffectName('')
    onFilesChange()
  }

  return (
    <section className="manage-section">
      <h2>Audio Assignments</h2>
      {storageInfo && (
        <div className="storage-info">
          Storage: {formatBytes(storageInfo.used)} · {storageInfo.fileCount} files
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept=".mp3,.m4a,.wav,.aac,.flac,.ogg,.mp4"
        multiple
        onChange={handleImportFiles}
        style={{ display: 'none' }}
      />
      <button className="btn-primary" onClick={() => fileInputRef.current?.click()}>
        Import Audio Files
      </button>
      <button
        type="button"
        className="btn-secondary danger"
        onClick={handleClearAll}
        disabled={!storedFiles.length}
      >
        Clear All Audio Files
      </button>

      <div className="assignment-form">
        <h3>Create Assignment</h3>
        <select
          className="input"
          value={selectedFile || ''}
          onChange={e => setSelectedFile(e.target.value || null)}
        >
          <option value="">Select file...</option>
          {storedFiles.length === 0 ? (
            <option disabled>Import files first</option>
          ) : (
            storedFiles.map(({ path, fileName }) => (
              <option key={path} value={path}>
                {fileName}
              </option>
            ))
          )}
        </select>
        <select className="input" value={purpose} onChange={e => setPurpose(e.target.value as PurposeType)}>
          <option value="Sound Effect">Sound Effect</option>
          <option value="In-Game Playlist">In-Game Playlist</option>
        </select>
        {purpose === 'Sound Effect' && (
          <>
            <input
              type="text"
              placeholder="Sound effect name"
              value={soundEffectName}
              onChange={e => setSoundEffectName(e.target.value)}
              className="input"
            />
            <select className="input" value={soundCategory} onChange={e => setSoundCategory(e.target.value as SoundEffectCategory)}>
              {SOUND_CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </>
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
        <button className="btn-primary" onClick={handleCreateAssignment} disabled={!selectedFile}>
          Add Assignment
        </button>
      </div>

      <div className="assignments-list">
        <h3>Existing Assignments</h3>
        {assignments
          .filter(a => a.purpose !== 'Player Music')
          .map(a => (
            <div key={a.id} className="assignment-row">
              <span>
                {a.purpose === 'Sound Effect' && a.soundEffectName
                  ? a.soundEffectName
                  : a.fileName.replace(/\.[^/.]+$/, '')}
              </span>
              <span className="purpose-badge">{a.purpose}</span>
              <button className="btn-small danger" onClick={() => removeAssignment(a)}>Remove</button>
            </div>
          ))}
        {assignments.filter(a => a.purpose !== 'Player Music').length === 0 && (
          <p className="empty-hint">Create assignments above after importing audio files.</p>
        )}
      </div>

      <div className="backup-section">
        <h3>Backup & Restore</h3>
        <div className="backup-actions">
          <button className="btn-primary" onClick={handleExport}>
            Export Config
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            style={{ display: 'none' }}
          />
          <button
            className="btn-secondary"
            onClick={() => importInputRef.current?.click()}
          >
            Import Config
          </button>
        </div>
        <p className="hint">Export saves players, assignments, and playlists. Import restores them (audio files stay in storage).</p>
      </div>
    </section>
  )
}

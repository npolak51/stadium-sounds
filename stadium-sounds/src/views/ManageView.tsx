import { useState, useRef, useEffect } from 'react'
import { useAppData } from '../context/AppDataContext'
import { storeAudioFile, getStorageUsage, getAllStoredFiles, clearAllAudioFiles } from '../lib/audioStorage'
import { previewPlay, getAudioDuration, subscribe, seekToFullPosition, preloadBlobs, clearBlobCache } from '../lib/audioService'
import TimeInput from '../components/TimeInput'
import ChooseAudioModal from '../components/ChooseAudioModal'
import EditAssignmentModal from '../components/EditAssignmentModal'
import PreviewTimeBar from '../components/PreviewTimeBar'
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
    updateAssignment,
    removeAssignment,
    setPlaylistOrder,
    exportConfiguration,
    importConfiguration
  } = useAppData()

  const [chooseAudioPlayerId, setChooseAudioPlayerId] = useState<string | null>(null)
  const [chooseAudioType, setChooseAudioType] = useState<'Player Music' | 'Pitcher Entrance'>('Player Music')

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
    const existingById = assignments.find(a => a.id === assignment.id)
    if (existingById) {
      updateAssignment(assignment)
    } else {
      const existing = assignments.find(
        a => a.purpose === assignment.purpose && a.player === assignment.player
      )
      if (existing) removeAssignment(existing)
      addAssignment(assignment)
    }
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
          onChooseWalkupMusic={(playerId) => {
            setChooseAudioType('Player Music')
            setChooseAudioPlayerId(playerId)
          }}
          onChoosePitcherEntrance={(playerId) => {
            setChooseAudioType('Pitcher Entrance')
            setChooseAudioPlayerId(playerId)
          }}
        />
      )}

      {chooseAudioPlayerId && (
        <ChooseAudioModal
          playerId={chooseAudioPlayerId}
          purpose={chooseAudioType}
          initialAssignment={assignments.find(
            a => a.purpose === chooseAudioType && a.player === chooseAudioPlayerId
          )}
          onSave={handleSavePlayerAudio}
          onClose={() => setChooseAudioPlayerId(null)}
          onFilesChange={loadStorageInfo}
        />
      )}

      {tab === 'audio' && (
        <AudioTab
          assignments={assignments}
          addAssignment={addAssignment}
          updateAssignment={updateAssignment}
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
  onChooseWalkupMusic,
  onChoosePitcherEntrance
}: {
  players: Player[]
  assignments: AudioAssignment[]
  addPlayer: (name: string, number: string, team: TeamType) => void
  updatePlayer: (player: Player, name: string, number: string, team: TeamType) => void
  removePlayer: (player: Player) => void
  onChooseWalkupMusic: (playerId: string) => void
  onChoosePitcherEntrance: (playerId: string) => void
}) {
  const playerMusic = assignments.filter(a => a.purpose === 'Player Music')
  const pitcherEntrance = assignments.filter(a => a.purpose === 'Pitcher Entrance')

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
              <th>Walkup Music</th>
              <th>Pitcher Entrance</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {players.map(p => {
              const walkupAssignment = playerMusic.find(a => a.player === p.id)
              const pitcherAssignment = pitcherEntrance.find(a => a.player === p.id)
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
                      className={walkupAssignment ? 'btn-primary btn-small' : 'btn-secondary btn-small'}
                      onClick={() => onChooseWalkupMusic(p.id)}
                    >
                      {walkupAssignment ? 'Edit' : 'Choose'}
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={pitcherAssignment ? 'btn-primary btn-small' : 'btn-secondary btn-small'}
                      onClick={() => onChoosePitcherEntrance(p.id)}
                    >
                      {pitcherAssignment ? 'Edit' : 'Choose'}
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

const DEFAULT_DURATION = 15

function AudioTab({
  assignments,
  addAssignment,
  updateAssignment,
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
  updateAssignment: (a: AudioAssignment) => void
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
  const [endTime, setEndTime] = useState(DEFAULT_DURATION)
  const [duration, setDuration] = useState(DEFAULT_DURATION)
  const [editingAssignment, setEditingAssignment] = useState<AudioAssignment | null>(null)
  const [fileDuration, setFileDuration] = useState<number | null>(null)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [fadeIn, setFadeIn] = useState(false)
  const [fadeOut, setFadeOut] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [storedFiles, setStoredFiles] = useState<{ path: string; fileName: string }[]>([])
  const importInputRef = useRef<HTMLInputElement>(null)
  const [playbackPosition, setPlaybackPosition] = useState<number | null>(null)

  useEffect(() => {
    getAllStoredFiles().then(setStoredFiles)
  }, [assignments])

  useEffect(() => {
    const unsub = subscribe((state) => {
      const isOurPreview = state.currentAssignment?.filePath === selectedFile
      setPlaybackPosition(isOurPreview ? state.fullPosition : null)
    })
    return () => { unsub() }
  }, [selectedFile])

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
    preloadBlobs([selectedFile])
  }, [selectedFile])

  useEffect(() => {
    if (!selectedFile) return
    setStartTime(0)
    if (purpose === 'In-Game Playlist') {
      // In-Game Playlist: use full file length only when we have it (no 60 fallback)
      if (fileDuration != null && fileDuration > 0) {
        setDuration(fileDuration)
        setEndTime(fileDuration)
      }
    } else {
      // Sound Effect: use file duration or default
      const dur = fileDuration ?? DEFAULT_DURATION
      setDuration(dur)
      setEndTime(dur)
    }
  }, [selectedFile, fileDuration, purpose])

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
    const fallbackDur = purpose === 'In-Game Playlist' ? (fileDuration ?? 0) : 60
    const end = endTime > startTime ? endTime : startTime + Math.max(1, fallbackDur)
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
    setEndTime(DEFAULT_DURATION)
    setDuration(DEFAULT_DURATION)
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
    if (!confirm('Are you sure? This will permanently delete all audio files and remove all assignments (Sound Effects, Playlist, Player Music, and Pitcher Entrance).')) return
    for (const a of assignments) {
      removeAssignment(a)
    }
    clearBlobCache()
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
        {selectedFile && fileDuration != null && fileDuration > 0 && (
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
        <button
          className="btn-primary"
          onClick={handleCreateAssignment}
          disabled={
            !selectedFile ||
            (purpose === 'In-Game Playlist' && (fileDuration == null || fileDuration <= 0))
          }
        >
          Add Assignment
        </button>
      </div>

      <div className="assignments-list">
        <h3>Existing Assignments</h3>
        {assignments
          .filter(a => a.purpose !== 'Player Music' && a.purpose !== 'Pitcher Entrance')
          .map(a => (
            <div key={a.id} className="assignment-row">
              <span>
                {a.purpose === 'Sound Effect' && a.soundEffectName
                  ? a.soundEffectName
                  : a.fileName.replace(/\.[^/.]+$/, '')}
              </span>
              <span className="purpose-badge">{a.purpose}</span>
              <button
                type="button"
                className="btn-secondary btn-small"
                onClick={() => setEditingAssignment(a)}
              >
                Edit
              </button>
              <button className="btn-small danger" onClick={() => removeAssignment(a)}>Remove</button>
            </div>
          ))}
        {assignments.filter(a => a.purpose !== 'Player Music' && a.purpose !== 'Pitcher Entrance').length === 0 && (
          <p className="empty-hint">Create assignments above after importing audio files.</p>
        )}
      </div>

      {editingAssignment && (
        <EditAssignmentModal
          assignment={editingAssignment}
          onSave={updated => {
            updateAssignment(updated)
            setEditingAssignment(null)
          }}
          onClose={() => setEditingAssignment(null)}
        />
      )}

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

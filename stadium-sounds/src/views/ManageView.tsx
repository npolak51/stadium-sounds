import { useState, useRef, useEffect } from 'react'
import { useAppData } from '../context/AppDataContext'
import { storeAudioFile, getStorageUsage, getAllStoredFiles } from '../lib/audioStorage'
import type { Player, AudioAssignment, SoundEffectCategory, PurposeType } from '../types'
import './ManageView.css'

type ManageTab = 'players' | 'audio' | 'files'

const SOUND_CATEGORIES: SoundEffectCategory[] = ['Pre/Postgame', 'Offense', 'Defense']

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
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const [name, setName] = useState('')
  const [number, setNumber] = useState('')
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null)

  const [storageInfo, setStorageInfo] = useState<{ used: number; fileCount: number } | null>(null)

  const loadStorageInfo = async () => {
    const info = await getStorageUsage()
    setStorageInfo(info)
  }

  const handleAddPlayer = () => {
    if (!name.trim() || !number.trim()) return
    if (editingPlayer) {
      updatePlayer(editingPlayer, name.trim(), number.trim())
      setEditingPlayer(null)
    } else {
      addPlayer(name.trim(), number.trim())
    }
    setName('')
    setNumber('')
  }

  const handleEditPlayer = (p: Player) => {
    setEditingPlayer(p)
    setName(p.name)
    setNumber(p.number)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (!['mp3', 'm4a', 'wav', 'aac', 'flac', 'ogg', 'mp4'].includes(ext || '')) continue
      const path = `${generateId()}_${file.name}`
      await storeAudioFile(path, file, file.name)
    }
    loadStorageInfo()
    e.target.value = ''
  }

  return (
    <div className="manage-view">
      <div className="manage-tabs">
        {(['players', 'audio', 'files'] as const).map(t => (
          <button
            key={t}
            className={`manage-tab ${tab === t ? 'active' : ''}`}
            onClick={() => {
              setTab(t)
              if (t === 'files') loadStorageInfo()
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'players' && (
        <section className="manage-section">
          <h2>Players</h2>
          <div className="player-form">
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="input"
            />
            <input
              type="text"
              placeholder="Jersey #"
              value={number}
              onChange={e => setNumber(e.target.value)}
              className="input"
            />
            <button
              className="btn-primary"
              onClick={handleAddPlayer}
              disabled={!name.trim() || !number.trim()}
            >
              {editingPlayer ? 'Update' : 'Add'} Player
            </button>
            {editingPlayer && (
              <button className="btn-secondary" onClick={() => { setEditingPlayer(null); setName(''); setNumber('') }}>
                Cancel
              </button>
            )}
          </div>
          <ul className="player-list">
            {players.map(p => (
              <li key={p.id} className="player-row">
                <span>#{p.number} {p.name}</span>
                <div>
                  <button className="btn-small" onClick={() => handleEditPlayer(p)}>Edit</button>
                  <button className="btn-small danger" onClick={() => removePlayer(p)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'audio' && (
        <AudioTab
          players={players}
          assignments={assignments}
          addAssignment={addAssignment}
          removeAssignment={removeAssignment}
          setPlaylistOrder={setPlaylistOrder}
          onFilesChange={loadStorageInfo}
        />
      )}

      {tab === 'files' && (
        <FilesTab
          storageInfo={storageInfo}
          exportConfiguration={exportConfiguration}
          importConfiguration={importConfiguration}
          fileInputRef={fileInputRef}
          onFileSelect={handleFileUpload}
        />
      )}
    </div>
  )
}

function AudioTab({
  players,
  assignments,
  addAssignment,
  removeAssignment,
  setPlaylistOrder,
  onFilesChange
}: {
  players: Player[]
  assignments: AudioAssignment[]
  addAssignment: (a: AudioAssignment) => void
  removeAssignment: (a: AudioAssignment) => void
  setPlaylistOrder: (a: AudioAssignment) => void
  onFilesChange: () => void
}) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [purpose, setPurpose] = useState<PurposeType>('Player Music')
  const [playerId, setPlayerId] = useState('')
  const [soundCategory, setSoundCategory] = useState<SoundEffectCategory>('Pre/Postgame')
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(0)
  const [fadeIn, setFadeIn] = useState(false)
  const [fadeOut, setFadeOut] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [storedFiles, setStoredFiles] = useState<{ path: string; fileName: string }[]>([])

  useEffect(() => {
    getAllStoredFiles().then(setStoredFiles)
  }, [assignments])

  const handleImportFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (!['mp3', 'm4a', 'wav', 'aac', 'flac', 'ogg', 'mp4'].includes(ext || '')) continue
      const path = `${generateId()}_${file.name}`
      await storeAudioFile(path, file, file.name)
    }
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
      player: purpose === 'Player Music' ? playerId || undefined : undefined,
      soundEffectCategory: purpose === 'Sound Effect' ? soundCategory : undefined,
      playlistOrder: purpose === 'In-Game Playlist' ? 0 : undefined
    }
    addAssignment(assignment)
    if (purpose === 'In-Game Playlist') {
      setPlaylistOrder(assignment)
    }
    setSelectedFile(null)
    setStartTime(0)
    setEndTime(0)
  }

  return (
    <section className="manage-section">
      <h2>Audio Assignments</h2>
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
          <option value="Player Music">Player Music</option>
          <option value="Sound Effect">Sound Effect</option>
          <option value="In-Game Playlist">In-Game Playlist</option>
        </select>
        {purpose === 'Player Music' && (
          <select className="input" value={playerId} onChange={e => setPlayerId(e.target.value)}>
            <option value="">Select player...</option>
            {players.map(p => (
              <option key={p.id} value={p.id}>#{p.number} {p.name}</option>
            ))}
          </select>
        )}
        {purpose === 'Sound Effect' && (
          <select className="input" value={soundCategory} onChange={e => setSoundCategory(e.target.value as SoundEffectCategory)}>
            {SOUND_CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
        <label>
          Start (sec): <input type="number" className="input small" value={startTime} onChange={e => setStartTime(parseFloat(e.target.value) || 0)} />
        </label>
        <label>
          End (sec): <input type="number" className="input small" value={endTime} onChange={e => setEndTime(parseFloat(e.target.value) || 0)} />
        </label>
        <label>
          <input type="checkbox" checked={fadeIn} onChange={e => setFadeIn(e.target.checked)} />
          Fade in
        </label>
        <label>
          <input type="checkbox" checked={fadeOut} onChange={e => setFadeOut(e.target.checked)} />
          Fade out
        </label>
        <button className="btn-primary" onClick={handleCreateAssignment} disabled={!selectedFile}>
          Add Assignment
        </button>
      </div>

      <div className="assignments-list">
        <h3>Existing Assignments</h3>
        {assignments.map(a => (
          <div key={a.id} className="assignment-row">
            <span>{a.fileName.replace(/\.[^/.]+$/, '')}</span>
            <span className="purpose-badge">{a.purpose}</span>
            {a.player && <span>→ {players.find(p => p.id === a.player)?.name}</span>}
            <button className="btn-small danger" onClick={() => removeAssignment(a)}>Remove</button>
          </div>
        ))}
        {assignments.length === 0 && (
          <p className="empty-hint">Create assignments above after importing audio files.</p>
        )}
      </div>
    </section>
  )
}

function FilesTab({
  storageInfo,
  exportConfiguration,
  importConfiguration,
  fileInputRef,
  onFileSelect
}: {
  storageInfo: { used: number; fileCount: number } | null
  exportConfiguration: () => string
  importConfiguration: (json: string) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  const importInputRef = useRef<HTMLInputElement>(null)

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
      } catch (err) {
        alert('Invalid configuration file')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <section className="manage-section">
      <h2>Files & Storage</h2>
      {storageInfo && (
        <div className="storage-info">
          <p>Storage used: {formatBytes(storageInfo.used)}</p>
          <p>Files: {storageInfo.fileCount}</p>
        </div>
      )}
      <div className="file-actions">
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,.m4a,.wav,.aac,.flac,.ogg,.mp4"
          multiple
          onChange={onFileSelect}
          style={{ display: 'none' }}
        />
        <button className="btn-primary" onClick={() => fileInputRef.current?.click()}>
          Import Audio
        </button>
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
        <button className="btn-secondary" onClick={() => importInputRef.current?.click()}>
          Import Config
        </button>
      </div>
    </section>
  )
}

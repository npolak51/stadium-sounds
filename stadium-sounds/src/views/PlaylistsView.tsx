import { useState, useEffect } from 'react'
import { useAppData } from '../context/AppDataContext'
import { getAllStoredFiles } from '../lib/audioStorage'
import { getAudioDuration } from '../lib/audioService'
import type { SavedPlaylist, AudioAssignment } from '../types'
import './PlaylistsView.css'

function generateId() {
  return crypto.randomUUID()
}

async function createAssignmentFromFile(
  path: string,
  fileName: string,
  order: number
): Promise<AudioAssignment> {
  const duration = Math.max(1, (await getAudioDuration(path)) || 1)
  return {
    id: generateId(),
    fileName,
    filePath: path,
    purpose: 'In-Game Playlist',
    startTime: 0,
    endTime: duration,
    duration,
    fadeIn: false,
    fadeOut: false,
    playlistOrder: order
  }
}

export default function PlaylistsView() {
  const {
    savedPlaylists,
    assignments,
    loadPlaylist,
    deletePlaylist,
    saveCurrentPlaylist,
    addAssignmentsToPlaylist,
    updatePlaylist
  } = useAppData()

  const [mode, setMode] = useState<'list' | 'build' | 'edit'>('list')
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null)
  const [storedFiles, setStoredFiles] = useState<{ path: string; fileName: string }[]>([])

  const playlistItems = [...assignments]
    .filter(a => a.purpose === 'In-Game Playlist')
    .sort((a, b) => (a.playlistOrder ?? 0) - (b.playlistOrder ?? 0))

  useEffect(() => {
    getAllStoredFiles().then(setStoredFiles)
  }, [mode])

  const handleLoad = (p: SavedPlaylist) => {
    loadPlaylist(p)
  }

  const handleDelete = (p: SavedPlaylist) => {
    if (confirm(`Delete playlist "${p.name}"?`)) {
      deletePlaylist(p)
    }
  }

  return (
    <div className="playlists-view">
      <section className="playlists-section">
        <div className="section-header">
          <h2>Playlists</h2>
          <div className="section-actions">
            <button
              className="btn-primary"
              onClick={() => setMode('build')}
            >
              Build New Playlist
            </button>
            <button
              className="btn-secondary"
              onClick={() => setMode('list')}
              style={{ display: mode !== 'list' ? 'inline-flex' : 'none' }}
            >
              Back
            </button>
          </div>
        </div>

        {mode === 'build' && (
          <BuildPlaylistForm
            storedFiles={storedFiles}
            onSave={async (name, selectedPaths) => {
              const assignments = await Promise.all(
                selectedPaths.map((path, i) => {
                  const file = storedFiles.find(f => f.path === path)
                  return createAssignmentFromFile(
                    path,
                    file?.fileName ?? path.split('_').slice(1).join('_'),
                    i
                  )
                })
              )
              addAssignmentsToPlaylist(assignments, name)
              setMode('list')
            }}
            onCancel={() => {
              setEditingPlaylistId(null)
              setMode('list')
            }}
          />
        )}

        {mode === 'edit' && editingPlaylistId && (
          <EditPlaylistForm
            playlist={savedPlaylists.find(p => p.id === editingPlaylistId)!}
            storedFiles={storedFiles}
            onSave={(updated) => {
              updatePlaylist(updated)
              setEditingPlaylistId(null)
              setMode('list')
            }}
            onCancel={() => {
              setEditingPlaylistId(null)
              setMode('list')
            }}
          />
        )}

        {mode === 'list' && (
          <>
            <div className="save-current-row">
              <span className="save-current-label">Quick save from Game tab:</span>
              <button
                className="btn-secondary btn-small"
                onClick={() => {
                  const name = prompt('Playlist name?')
                  if (name?.trim()) saveCurrentPlaylist(name.trim())
                }}
                disabled={playlistItems.length === 0}
              >
                Save Current as Playlist
              </button>
            </div>

            <div className="playlist-cards">
              {savedPlaylists.map(playlist => (
                <div key={playlist.id} className="playlist-card">
                  <div className="playlist-card-header">
                    <h3>{playlist.name}</h3>
                    <span className="song-count">{playlist.assignments.length} songs</span>
                  </div>
                  <div className="playlist-card-actions">
                    <button className="btn-primary" onClick={() => handleLoad(playlist)}>
                      Load
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => {
                        setEditingPlaylistId(playlist.id)
                        setMode('edit')
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn-danger-outline"
                      onClick={() => handleDelete(playlist)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {savedPlaylists.length === 0 && (
                <p className="empty-state">
                  No playlists yet. Click &quot;Build New Playlist&quot; to create one from your
                  uploaded audio files.
                </p>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function BuildPlaylistForm({
  storedFiles,
  onSave,
  onCancel
}: {
  storedFiles: { path: string; fileName: string }[]
  onSave: (name: string, selectedPaths: string[]) => void | Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)

  const toggleFile = (path: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === storedFiles.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(storedFiles.map(f => f.path)))
    }
  }

  const handleSave = async () => {
    if (!name.trim() || selected.size === 0) return
    setIsSaving(true)
    try {
      await onSave(name.trim(), Array.from(selected))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="playlist-form build-form">
      <h3>Build New Playlist</h3>
      <input
        type="text"
        placeholder="Playlist name"
        value={name}
        onChange={e => setName(e.target.value)}
        className="input"
        autoFocus
      />
      <div className="file-select-section">
        <div className="file-select-header">
          <span>Select audio files to include</span>
          <button type="button" className="btn-link" onClick={toggleAll}>
            {selected.size === storedFiles.length ? 'Deselect all' : 'Select all'}
          </button>
        </div>
        {storedFiles.length === 0 ? (
          <p className="hint">No audio files yet. Import files in Manage → Audio or Files.</p>
        ) : (
          <div className="file-checkbox-list">
            {storedFiles.map(({ path, fileName }) => (
              <label key={path} className="file-checkbox-row">
                <input
                  type="checkbox"
                  checked={selected.has(path)}
                  onChange={() => toggleFile(path)}
                />
                <span className="file-name">{fileName.replace(/\.[^/.]+$/, '')}</span>
              </label>
            ))}
          </div>
        )}
      </div>
      <div className="form-actions">
        <button
          className="btn-primary"
          onClick={handleSave}
          disabled={!name.trim() || selected.size === 0 || isSaving}
        >
          {isSaving ? 'Creating…' : 'Create Playlist'}
        </button>
        <button className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function EditPlaylistForm({
  playlist: initialPlaylist,
  storedFiles,
  onSave,
  onCancel
}: {
  playlist: SavedPlaylist
  storedFiles: { path: string; fileName: string }[]
  onSave: (playlist: SavedPlaylist) => void
  onCancel: () => void
}) {
  const [playlist, setPlaylist] = useState(initialPlaylist)
  const [showAddSongs, setShowAddSongs] = useState(false)

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const items = [...playlist.assignments]
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= items.length) return
    ;[items[index], items[newIndex]] = [items[newIndex], items[index]]
    const withOrder = items.map((a, i) => ({ ...a, playlistOrder: i }))
    setPlaylist(p => ({ ...p, assignments: withOrder }))
  }

  const removeItem = (index: number) => {
    const items = playlist.assignments.filter((_, i) => i !== index)
    const withOrder = items.map((a, i) => ({ ...a, playlistOrder: i }))
    setPlaylist(p => ({ ...p, assignments: withOrder }))
  }

  const updateItem = (index: number, updates: Partial<AudioAssignment>) => {
    setPlaylist(p => ({
      ...p,
      assignments: p.assignments.map((a, i) =>
        i === index ? { ...a, ...updates, duration: (updates.endTime ?? a.endTime) - (updates.startTime ?? a.startTime) } : a
      )
    }))
  }

  const [isAddingSongs, setIsAddingSongs] = useState(false)

  const addSongs = async (paths: string[]) => {
    setIsAddingSongs(true)
    try {
      const maxOrder = Math.max(-1, ...playlist.assignments.map(a => a.playlistOrder ?? 0))
      const newItems = await Promise.all(
        paths.map((path, i) => {
          const file = storedFiles.find(f => f.path === path)
          return createAssignmentFromFile(
            path,
            file?.fileName ?? path.split('_').slice(1).join('_'),
            maxOrder + 1 + i
          )
        })
      )
      setPlaylist(p => ({
        ...p,
        assignments: [...p.assignments, ...newItems]
      }))
      setShowAddSongs(false)
    } finally {
      setIsAddingSongs(false)
    }
  }

  return (
    <div className="playlist-form edit-form">
      <h3>Edit Playlist</h3>
      <input
        type="text"
        value={playlist.name}
        onChange={e => setPlaylist(p => ({ ...p, name: e.target.value }))}
        className="input"
        placeholder="Playlist name"
      />

      <div className="edit-songs-header">
        <span>Songs</span>
        <button
          type="button"
          className="btn-secondary btn-small"
          onClick={() => setShowAddSongs(!showAddSongs)}
        >
          {showAddSongs ? 'Cancel' : 'Add songs'}
        </button>
      </div>

      {showAddSongs && (
        <AddSongsPicker
          storedFiles={storedFiles}
          existingPaths={new Set(playlist.assignments.map(a => a.filePath))}
          onAdd={addSongs}
          isAdding={isAddingSongs}
        />
      )}

      <div className="edit-songs-list">
        {playlist.assignments.map((item, index) => (
          <div key={item.id} className="edit-song-row">
            <div className="reorder-buttons">
              <button
                type="button"
                className="btn-icon"
                onClick={() => moveItem(index, 'up')}
                disabled={index === 0}
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                className="btn-icon"
                onClick={() => moveItem(index, 'down')}
                disabled={index === playlist.assignments.length - 1}
                aria-label="Move down"
              >
                ↓
              </button>
            </div>
            <span className="song-index">{index + 1}</span>
            <span className="song-title">{item.fileName.replace(/\.[^/.]+$/, '')}</span>
            <div className="song-times">
              <label>
                Start
                <input
                  type="number"
                  className="input-small"
                  value={item.startTime}
                  onChange={e => updateItem(index, { startTime: parseFloat(e.target.value) || 0 })}
                  min={0}
                  step={0.1}
                />
              </label>
              <label>
                End
                <input
                  type="number"
                  className="input-small"
                  value={item.endTime}
                  onChange={e => updateItem(index, { endTime: parseFloat(e.target.value) || 0 })}
                  min={0}
                  step={0.1}
                />
              </label>
            </div>
            <button
              type="button"
              className="btn-icon btn-remove"
              onClick={() => removeItem(index)}
              aria-label="Remove"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="form-actions">
        <button className="btn-primary" onClick={() => onSave(playlist)}>
          Save Changes
        </button>
        <button className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function AddSongsPicker({
  storedFiles,
  existingPaths,
  onAdd,
  isAdding
}: {
  storedFiles: { path: string; fileName: string }[]
  existingPaths: Set<string>
  onAdd: (paths: string[]) => void | Promise<void>
  isAdding?: boolean
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggleFile = (path: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const availableFiles = storedFiles.filter(f => !existingPaths.has(f.path))

  return (
    <div className="add-songs-picker">
      {availableFiles.length === 0 ? (
        <p className="hint">All uploaded files are already in this playlist.</p>
      ) : (
        <>
          <div className="file-checkbox-list">
            {availableFiles.map(({ path, fileName }) => (
              <label key={path} className="file-checkbox-row">
                <input
                  type="checkbox"
                  checked={selected.has(path)}
                  onChange={() => toggleFile(path)}
                />
                <span className="file-name">{fileName.replace(/\.[^/.]+$/, '')}</span>
              </label>
            ))}
          </div>
          <button
            className="btn-primary btn-small"
            onClick={async () => await onAdd(Array.from(selected))}
            disabled={selected.size === 0 || isAdding}
          >
            {isAdding ? 'Adding…' : `Add ${selected.size} song${selected.size !== 1 ? 's' : ''}`}
          </button>
        </>
      )}
    </div>
  )
}

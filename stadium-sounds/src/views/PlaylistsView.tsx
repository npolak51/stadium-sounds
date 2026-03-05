import { useState } from 'react'
import { useAppData } from '../context/AppDataContext'
import type { SavedPlaylist } from '../types'
import './PlaylistsView.css'

export default function PlaylistsView() {
  const {
    savedPlaylists,
    assignments,
    loadPlaylist,
    deletePlaylist,
    saveCurrentPlaylist
  } = useAppData()

  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const playlistItems = [...assignments]
    .filter(a => a.purpose === 'In-Game Playlist')
    .sort((a, b) => (a.playlistOrder ?? 0) - (b.playlistOrder ?? 0))

  const handleSaveCurrent = () => {
    if (!newPlaylistName.trim()) return
    saveCurrentPlaylist(newPlaylistName.trim())
    setNewPlaylistName('')
    setShowCreate(false)
  }

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
          <h2>Saved Playlists</h2>
          <button
            className="btn-primary"
            onClick={() => setShowCreate(true)}
          >
            Save Current as Playlist
          </button>
        </div>

        {showCreate && (
          <div className="create-playlist-form">
            <input
              type="text"
              placeholder="Playlist name"
              value={newPlaylistName}
              onChange={e => setNewPlaylistName(e.target.value)}
              className="input"
              autoFocus
            />
            <div className="form-actions">
              <button
                className="btn-primary"
                onClick={handleSaveCurrent}
                disabled={!newPlaylistName.trim() || playlistItems.length === 0}
              >
                Save
              </button>
              <button className="btn-secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
            </div>
            {playlistItems.length === 0 && (
              <p className="hint">Add songs to the In-Game Playlist first (Manage → Audio)</p>
            )}
          </div>
        )}

        <div className="playlist-cards">
          {savedPlaylists.map(playlist => (
            <div key={playlist.id} className="playlist-card">
              <div className="playlist-card-header">
                <h3>{playlist.name}</h3>
                <span className="song-count">{playlist.assignments.length} songs</span>
              </div>
              <div className="playlist-card-actions">
                <button
                  className="btn-primary"
                  onClick={() => handleLoad(playlist)}
                >
                  Load
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
          {savedPlaylists.length === 0 && !showCreate && (
            <p className="empty-state">
              No saved playlists yet. Build your In-Game Playlist in the Game tab, then save it here.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { useAppData } from '../context/AppDataContext'
import {
  subscribe,
  play,
  stop,
  preloadBlobs,
  togglePlayPause,
  seekTo,
  type PlaybackState
} from '../lib/audioService'
import type { Player, AudioAssignment, SavedPlaylist } from '../types'
import './GameView.css'
import type { SoundEffectCategory, TeamType } from '../types'

const TEAMS: TeamType[] = ['Varsity', 'JV Blue', 'JV Gold']

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function GameView() {
  const {
    players,
    assignments,
    savedPlaylists,
    loadPlaylist,
    deletePlaylist,
    reorderPlayerMusic
  } = useAppData()

  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null)
  const [currentPlayingPlayerId, setCurrentPlayingPlayerId] = useState<string | null>(null)
  const [currentPlayingSoundEffectId, setCurrentPlayingSoundEffectId] = useState<string | null>(null)
  const [currentPlayingPlaylistId, setCurrentPlayingPlaylistId] = useState<string | null>(null)
  const [selectedSoundCategory, setSelectedSoundCategory] = useState<SoundEffectCategory>('Pre/Postgame')
  const [selectedTeam, setSelectedTeam] = useState<TeamType>('Varsity')
  const [shuffleEnabled, setShuffleEnabled] = useState(false)
  const [repeatMode, setRepeatMode] = useState<'None' | 'All' | 'One'>('None')
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState(0)
  const [showLoadPlaylist, setShowLoadPlaylist] = useState(false)
  const [preloadReady, setPreloadReady] = useState(false)

  const playerMusic = [...assignments]
    .filter(a => a.purpose === 'Player Music')
    .sort((a, b) => (a.playerOrder ?? 0) - (b.playerOrder ?? 0))
  const soundEffects = assignments.filter(a => a.purpose === 'Sound Effect')
  const playlistItems = [...assignments]
    .filter(a => a.purpose === 'In-Game Playlist')
    .sort((a, b) => (a.playlistOrder ?? 0) - (b.playlistOrder ?? 0))

  const soundEffectsByCategory = soundEffects.filter(
    a => a.soundEffectCategory === selectedSoundCategory
  )

  const playersForTeam = playerMusic
    .filter(a => {
      const p = players.find(pl => pl.id === a.player)
      return p?.team === selectedTeam
    })
    .map(a => players.find(p => p.id === a.player)!)
    .filter(Boolean)

  useEffect(() => {
    const unsub = subscribe(setPlaybackState)
    return () => { unsub() }
  }, [])

  const playablePaths = assignments
    .filter(
      a => a.purpose === 'Player Music' || a.purpose === 'Sound Effect' || a.purpose === 'In-Game Playlist'
    )
    .map(a => a.filePath)
    .filter(Boolean)

  // Preload audio blobs before enabling play. Required for iPad: play() must run synchronously
  // within user gesture; async blob fetch from IndexedDB breaks the gesture chain.
  useEffect(() => {
    if (playablePaths.length === 0) {
      setPreloadReady(true)
      return
    }
    setPreloadReady(false)
    preloadBlobs(playablePaths).then(() => setPreloadReady(true))
  }, [assignments])

  const [playError, setPlayError] = useState<string | null>(null)

  const playAssignment = useCallback(async (a: AudioAssignment) => {
    setPlayError(null)
    try {
      await play(a)
      if (a.purpose === 'Player Music') {
        setCurrentPlayingPlayerId(a.player ?? null)
        setCurrentPlayingSoundEffectId(null)
        setCurrentPlayingPlaylistId(null)
      } else if (a.purpose === 'Sound Effect') {
        setCurrentPlayingSoundEffectId(a.id)
        setCurrentPlayingPlayerId(null)
        setCurrentPlayingPlaylistId(null)
      } else {
        setCurrentPlayingPlaylistId(a.id)
        setCurrentPlayingPlayerId(null)
        setCurrentPlayingSoundEffectId(null)
      }
    } catch (e) {
      console.error(e)
      setPlayError(e instanceof Error ? e.message : 'Playback failed')
    }
  }, [])

  const handlePlayPlayer = useCallback(
    (player: Player) => {
      const assignment = playerMusic.find(a => a.player === player.id)
      if (assignment) playAssignment(assignment)
    },
    [playerMusic, playAssignment]
  )

  const handlePlaySoundEffect = useCallback(
    (a: AudioAssignment) => playAssignment(a),
    [playAssignment]
  )

  const handlePlayPlaylistSong = useCallback(
    (index: number) => {
      const item = playlistItems[index]
      if (item) playAssignment(item)
    },
    [playlistItems, playAssignment]
  )

  const handleStop = useCallback(() => {
    stop()
    setCurrentPlayingPlayerId(null)
    setCurrentPlayingSoundEffectId(null)
    setCurrentPlayingPlaylistId(null)
  }, [])

  const handleLoadPlaylist = useCallback((p: SavedPlaylist) => {
    loadPlaylist(p)
    setShowLoadPlaylist(false)
  }, [loadPlaylist])

  const isPlaylistMode = playbackState?.currentAssignment?.purpose === 'In-Game Playlist'

  return (
    <div className="game-view">
      {playError && (
        <div className="play-error-toast" role="alert">
          {playError}
          <button type="button" onClick={() => setPlayError(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
      {/* Playback controls - show when something is playing */}
      {(playbackState?.currentAssignment || playbackState?.isPlaying) && (
        <div className="playback-bar">
          <div className="playback-progress-wrap">
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={playbackState?.progress ?? 0}
              onChange={e => seekTo(parseFloat(e.target.value))}
              className="playback-slider"
            />
          </div>
          <div className="playback-info">
            <span className="playback-time">
              {formatTime(playbackState?.currentTime ?? 0)}
            </span>
            <span className="playback-remaining">
              -{formatTime(playbackState?.remainingTime ?? 0)}
            </span>
          </div>
          <div className="playback-controls">
            {isPlaylistMode && (
              <>
                <button
                  className="playback-btn"
                  onClick={() => handlePlayPlaylistSong(Math.max(0, currentPlaylistIndex - 1))}
                  disabled={playlistItems.length <= 1}
                >
                  ⏮
                </button>
              </>
            )}
            <button className="playback-btn play-pause" onClick={togglePlayPause}>
              {playbackState?.isPlaying ? '⏸' : '▶'}
            </button>
            {isPlaylistMode && (
              <button
                className="playback-btn"
                onClick={() =>
                  handlePlayPlaylistSong(
                    Math.min(playlistItems.length - 1, currentPlaylistIndex + 1)
                  )
                }
                disabled={playlistItems.length <= 1}
              >
                ⏭
              </button>
            )}
            <button className="playback-btn stop-btn" onClick={handleStop}>
              STOP
            </button>
          </div>
        </div>
      )}

      {playablePaths.length > 0 && !preloadReady && (
        <div className="preload-overlay" role="status" aria-live="polite">
          Preparing audio…
        </div>
      )}
      <div className={`game-grid ${!preloadReady ? 'preload-pending' : ''}`}>
        {/* Player lineup */}
        <section className="game-section">
          <h2 className="section-title">Player Music</h2>
          <div className="sound-category-tabs">
            {TEAMS.map(team => (
              <button
                key={team}
                className={`cat-tab ${selectedTeam === team ? 'active' : ''}`}
                onClick={() => setSelectedTeam(team)}
              >
                {team}
              </button>
            ))}
          </div>
          <div className="player-list">
            {playersForTeam.map((player, index) => {
                const assignment = playerMusic.find(a => a.player === player.id)
                const isActive = currentPlayingPlayerId === player.id
                if (!assignment) return null
                return (
                  <div key={player.id} className="player-row">
                    <div className="reorder-buttons">
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={e => {
                          e.stopPropagation()
                          reorderPlayerMusic(assignment.id, 'up')
                        }}
                        disabled={index === 0}
                        aria-label="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={e => {
                          e.stopPropagation()
                          reorderPlayerMusic(assignment.id, 'down')
                        }}
                        disabled={index === playersForTeam.length - 1}
                        aria-label="Move down"
                      >
                        ↓
                      </button>
                    </div>
                    <button
                      className={`player-btn ${isActive ? 'active' : ''}`}
                      onClick={() => handlePlayPlayer(player)}
                      disabled={!preloadReady}
                    >
                      <span className="player-number">#{player.number}</span>
                      <span className="player-name">{player.name}</span>
                      {isActive && <span className="playing-indicator">♪</span>}
                    </button>
                  </div>
                )
              })}
            {playersForTeam.length === 0 && (
              <p className="empty-hint">Add players and assign music in Manage</p>
            )}
          </div>
        </section>

        {/* Sound effects */}
        <section className="game-section">
          <h2 className="section-title">Sound Effects</h2>
          <div className="sound-category-tabs">
            {(['Pre/Postgame', 'Offense', 'Defense'] as const).map(cat => (
              <button
                key={cat}
                className={`cat-tab ${selectedSoundCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedSoundCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="sound-effect-grid">
            {soundEffectsByCategory.map(a => {
              const isActive = currentPlayingSoundEffectId === a.id
              return (
                <button
                  key={a.id}
                  className={`sound-btn ${isActive ? 'active' : ''}`}
                  onClick={() => handlePlaySoundEffect(a)}
                  disabled={!preloadReady}
                >
                  {a.soundEffectName || a.fileName.replace(/\.[^/.]+$/, '')}
                  {isActive && <span className="playing-indicator">♪</span>}
                </button>
              )
            })}
            {soundEffectsByCategory.length === 0 && (
              <p className="empty-hint">Add sound effects in Manage → Audio</p>
            )}
          </div>
        </section>
      </div>

      {/* In-game playlist */}
      <section className="playlist-section">
        <div className="playlist-header">
          <h2 className="section-title">In-Game Playlist</h2>
          <div className="playlist-actions">
            <button
              className={`icon-btn ${shuffleEnabled ? 'active' : ''}`}
              onClick={() => setShuffleEnabled(!shuffleEnabled)}
              title="Shuffle"
            >
              🔀
            </button>
            <button
              className={`icon-btn ${repeatMode !== 'None' ? 'active' : ''}`}
              onClick={() =>
                setRepeatMode(
                  repeatMode === 'None' ? 'All' : repeatMode === 'All' ? 'One' : 'None'
                )
              }
              title="Repeat"
            >
              🔁
            </button>
            <button className="load-playlist-btn" onClick={() => setShowLoadPlaylist(true)}>
              Load Playlist
            </button>
          </div>
        </div>
        <div className="playlist-tracks">
          {playlistItems.map((item, i) => {
            const isActive = currentPlayingPlaylistId === item.id
            return (
              <button
                key={item.id}
                className={`playlist-track ${isActive ? 'active' : ''}`}
                onClick={() => {
                  setCurrentPlaylistIndex(i)
                  handlePlayPlaylistSong(i)
                }}
                disabled={!preloadReady}
              >
                <span className="track-num">{i + 1}</span>
                <span className="track-name">{item.fileName.replace(/\.[^/.]+$/, '')}</span>
                {isActive && <span className="playing-indicator">♪</span>}
              </button>
            )
          })}
          {playlistItems.length === 0 && (
            <p className="empty-hint">Add songs in Manage → Audio, or load a saved playlist</p>
          )}
        </div>
      </section>

      {/* Load playlist modal */}
      {showLoadPlaylist && (
        <div className="modal-overlay" onClick={() => setShowLoadPlaylist(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Load Playlist</h3>
            <div className="playlist-list">
              {savedPlaylists.map(p => (
                <div key={p.id} className="playlist-row">
                  <div>
                    <strong>{p.name}</strong>
                    <span className="muted"> ({p.assignments.length} songs)</span>
                  </div>
                  <div className="playlist-row-actions">
                    <button
                      className="btn-primary"
                      onClick={() => handleLoadPlaylist(p)}
                    >
                      Load
                    </button>
                    <button
                      className="btn-danger"
                      onClick={() => deletePlaylist(p)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn-secondary" onClick={() => setShowLoadPlaylist(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

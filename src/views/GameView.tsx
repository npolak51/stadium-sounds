import { useState, useEffect, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAppData } from '../context/AppDataContext'
import {
  subscribe,
  play,
  stop,
  preloadBlobs,
  togglePlayPause,
  seekTo,
  setVolume,
  type PlaybackState
} from '../lib/audioService'
import type { Player, AudioAssignment, SavedPlaylist } from '../types'
import './GameView.css'
import type { SoundEffectCategory, TeamType } from '../types'

const TEAMS: TeamType[] = ['Varsity', 'JV Blue', 'JV Gold']

function SortablePlayerRow({
  assignmentId,
  player,
  isActive,
  preloadReady,
  onPlay
}: {
  assignmentId: string
  player: Player
  isActive: boolean
  preloadReady: boolean
  onPlay: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: assignmentId
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }
  return (
    <div ref={setNodeRef} style={style} className="player-row">
      <div
        className="player-drag-handle"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        ⋮⋮
      </div>
      <button
        className={`player-btn ${isActive ? 'active' : ''}`}
        onClick={onPlay}
        disabled={!preloadReady}
      >
        <span className="player-number">#{player.number}</span>
        <span className="player-name">{player.name}</span>
        {isActive && <span className="playing-indicator">♪</span>}
      </button>
    </div>
  )
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function playbackTrackLabel(a: AudioAssignment | null | undefined): string {
  if (!a) return ''
  const name = a.fileName?.trim()
  if (name) return name
  const p = a.filePath
  const i = p.lastIndexOf('/')
  return i >= 0 ? p.slice(i + 1) : p
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
  const [currentPlayingPitcherEntranceId, setCurrentPlayingPitcherEntranceId] = useState<string | null>(null)
  const [currentPlayingSoundEffectId, setCurrentPlayingSoundEffectId] = useState<string | null>(null)
  const [currentPlayingPlaylistId, setCurrentPlayingPlaylistId] = useState<string | null>(null)
  const [selectedSoundCategory, setSelectedSoundCategory] = useState<SoundEffectCategory>('Pre/Postgame')
  const [selectedTeam, setSelectedTeam] = useState<TeamType>('Varsity')
  const [selectedPitcherTeam, setSelectedPitcherTeam] = useState<TeamType>('Varsity')
  const [shuffleEnabled, setShuffleEnabled] = useState(false)
  const [repeatMode, setRepeatMode] = useState<'None' | 'All' | 'One'>('None')
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState(0)
  const [showLoadPlaylist, setShowLoadPlaylist] = useState(false)
  const [preloadReady, setPreloadReady] = useState(false)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  const playerMusic = [...assignments]
    .filter(a => a.purpose === 'Player Music')
    .sort((a, b) => (a.playerOrder ?? 0) - (b.playerOrder ?? 0))
  const pitcherEntrance = [...assignments]
    .filter(a => a.purpose === 'Pitcher Entrance')
    .sort((a, b) => (a.playerOrder ?? 0) - (b.playerOrder ?? 0))
  const soundEffects = assignments.filter(a => a.purpose === 'Sound Effect')
  const playlistItems = [...assignments]
    .filter(a => a.purpose === 'In-Game Playlist')
    .sort((a, b) => (a.playlistOrder ?? 0) - (b.playlistOrder ?? 0))

  const soundEffectsByCategory = soundEffects.filter(
    a => a.soundEffectCategory === selectedSoundCategory
  )

  const teamAssignments = playerMusic.filter(a => {
    const p = players.find(pl => pl.id === a.player)
    return p?.team === selectedTeam
  })
  const playersForTeam = teamAssignments
    .map(a => players.find(p => p.id === a.player)!)
    .filter(Boolean)
  const teamAssignmentIds = teamAssignments.map(a => a.id)

  const pitcherTeamAssignments = pitcherEntrance.filter(a => {
    const p = players.find(pl => pl.id === a.player)
    return p?.team === selectedPitcherTeam
  })
  const pitchersForTeam = pitcherTeamAssignments
    .map(a => players.find(p => p.id === a.player)!)
    .filter(Boolean)
  const pitcherAssignmentIds = pitcherTeamAssignments.map(a => a.id)

  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 }
    }),
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handlePlayerDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as string)
  }, [])

  const [activePitcherDragId, setActivePitcherDragId] = useState<string | null>(null)
  const handlePitcherDragStart = useCallback((event: DragStartEvent) => {
    setActivePitcherDragId(event.active.id as string)
  }, [])

  const handlePlayerDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragId(null)
      const { active, over } = event
      if (!over || active.id === over.id) return
      const oldIndex = teamAssignmentIds.indexOf(active.id as string)
      const newIndex = teamAssignmentIds.indexOf(over.id as string)
      if (oldIndex < 0 || newIndex < 0) return
      const newOrder = arrayMove(teamAssignmentIds, oldIndex, newIndex)
      reorderPlayerMusic(newOrder)
    },
    [teamAssignmentIds, reorderPlayerMusic]
  )

  const handlePitcherDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActivePitcherDragId(null)
      const { active, over } = event
      if (!over || active.id === over.id) return
      const oldIndex = pitcherAssignmentIds.indexOf(active.id as string)
      const newIndex = pitcherAssignmentIds.indexOf(over.id as string)
      if (oldIndex < 0 || newIndex < 0) return
      const newOrder = arrayMove(pitcherAssignmentIds, oldIndex, newIndex)
      reorderPlayerMusic(newOrder)
    },
    [pitcherAssignmentIds, reorderPlayerMusic]
  )

  useEffect(() => {
    const unsub = subscribe(setPlaybackState)
    return () => { unsub() }
  }, [])

  useEffect(() => {
    if (!playbackState?.currentAssignment) {
      setCurrentPlayingPlayerId(null)
      setCurrentPlayingPitcherEntranceId(null)
      setCurrentPlayingSoundEffectId(null)
      setCurrentPlayingPlaylistId(null)
    }
  }, [playbackState?.currentAssignment])

  const playablePaths = assignments
    .filter(
      a => a.purpose === 'Player Music' || a.purpose === 'Pitcher Entrance' || a.purpose === 'Sound Effect' || a.purpose === 'In-Game Playlist'
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
        setCurrentPlayingPitcherEntranceId(null)
        setCurrentPlayingSoundEffectId(null)
        setCurrentPlayingPlaylistId(null)
      } else if (a.purpose === 'Pitcher Entrance') {
        setCurrentPlayingPlayerId(null)
        setCurrentPlayingPitcherEntranceId(a.id)
        setCurrentPlayingSoundEffectId(null)
        setCurrentPlayingPlaylistId(null)
      } else if (a.purpose === 'Sound Effect') {
        setCurrentPlayingSoundEffectId(a.id)
        setCurrentPlayingPlayerId(null)
        setCurrentPlayingPitcherEntranceId(null)
        setCurrentPlayingPlaylistId(null)
      } else {
        setCurrentPlayingPlaylistId(a.id)
        setCurrentPlayingPlayerId(null)
        setCurrentPlayingPitcherEntranceId(null)
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

  const handlePlayPitcherEntrance = useCallback(
    (player: Player) => {
      const assignment = pitcherEntrance.find(a => a.player === player.id)
      if (assignment) playAssignment(assignment)
    },
    [pitcherEntrance, playAssignment]
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
  }, [])

  const handleLoadPlaylist = useCallback(async (p: SavedPlaylist) => {
    await loadPlaylist(p)
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
          <div className="playback-track-name" title={playbackTrackLabel(playbackState?.currentAssignment ?? undefined)}>
            {playbackTrackLabel(playbackState?.currentAssignment ?? undefined)}
          </div>
          <div className="playback-progress-wrap">
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={playbackState?.progress ?? 0}
              onChange={e => seekTo(parseFloat(e.target.value))}
              className="playback-slider"
              aria-label="Playback position"
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
          <div className="playback-bottom-row">
            <label className="playback-volume">
              <span className="playback-volume-label">Vol</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={playbackState?.volume ?? 1}
                onChange={e => setVolume(parseFloat(e.target.value))}
                className="playback-volume-slider"
                aria-label="Volume"
              />
            </label>
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
              <button type="button" className="playback-btn stop-btn" onClick={handleStop}>
                STOP
              </button>
            </div>
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
          <h2 className="section-title">Walkup Songs</h2>
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
            {teamAssignmentIds.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handlePlayerDragStart}
                onDragEnd={handlePlayerDragEnd}
              >
                <SortableContext
                  items={teamAssignmentIds}
                  strategy={verticalListSortingStrategy}
                >
                  {teamAssignments.map((assignment, index) => {
                    const player = playersForTeam[index]
                    if (!player) return null
                    const isActive = currentPlayingPlayerId === player.id
                    return (
                      <SortablePlayerRow
                        key={assignment.id}
                        assignmentId={assignment.id}
                        player={player}
                        isActive={isActive}
                        preloadReady={preloadReady}
                        onPlay={() => handlePlayPlayer(player)}
                      />
                    )
                  })}
                </SortableContext>
                <DragOverlay dropAnimation={null}>
                  {activeDragId ? (
                    (() => {
                      const idx = teamAssignments.findIndex(a => a.id === activeDragId)
                      const player = idx >= 0 ? playersForTeam[idx] : null
                      if (!player) return null
                      return (
                        <div className="player-row player-row-dragging">
                          <div className="player-drag-handle">⋮⋮</div>
                          <div className="player-btn">
                            <span className="player-number">#{player.number}</span>
                            <span className="player-name">{player.name}</span>
                          </div>
                        </div>
                      )
                    })()
                  ) : null}
                </DragOverlay>
              </DndContext>
            ) : (
              <p className="empty-hint">Add players and assign music in Manage</p>
            )}
          </div>
        </section>

        {/* Sound Effects + Pitcher Entrance - stacked to match Player Music height */}
        <div className="game-section-stack">
          <section className="game-section game-section-half">
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

          <section className="game-section game-section-half">
            <h2 className="section-title">Pitcher Entrance</h2>
            <div className="sound-category-tabs">
              {TEAMS.map(team => (
                <button
                  key={team}
                  className={`cat-tab ${selectedPitcherTeam === team ? 'active' : ''}`}
                  onClick={() => setSelectedPitcherTeam(team)}
                >
                  {team}
                </button>
              ))}
            </div>
            <div className="player-list">
              {pitcherAssignmentIds.length > 0 ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handlePitcherDragStart}
                  onDragEnd={handlePitcherDragEnd}
                >
                  <SortableContext
                    items={pitcherAssignmentIds}
                    strategy={verticalListSortingStrategy}
                  >
                    {pitcherTeamAssignments.map((assignment, index) => {
                      const player = pitchersForTeam[index]
                      if (!player) return null
                      const isActive = currentPlayingPitcherEntranceId === assignment.id
                      return (
                        <SortablePlayerRow
                          key={assignment.id}
                          assignmentId={assignment.id}
                          player={player}
                          isActive={isActive}
                          preloadReady={preloadReady}
                          onPlay={() => handlePlayPitcherEntrance(player)}
                        />
                      )
                    })}
                  </SortableContext>
                  <DragOverlay dropAnimation={null}>
                    {activePitcherDragId ? (
                      (() => {
                        const idx = pitcherTeamAssignments.findIndex(a => a.id === activePitcherDragId)
                        const player = idx >= 0 ? pitchersForTeam[idx] : null
                        if (!player) return null
                        return (
                          <div className="player-row player-row-dragging">
                            <div className="player-drag-handle">⋮⋮</div>
                            <div className="player-btn">
                              <span className="player-number">#{player.number}</span>
                              <span className="player-name">{player.name}</span>
                            </div>
                          </div>
                        )
                      })()
                    ) : null}
                  </DragOverlay>
                </DndContext>
              ) : (
                <p className="empty-hint">Assign pitcher entrance music in Manage → Players</p>
              )}
            </div>
          </section>
        </div>
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

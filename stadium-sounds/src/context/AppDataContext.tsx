import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  useRef
} from 'react'
import type { ReactNode } from 'react'
import type { Player, AudioAssignment, SavedPlaylist, AppConfiguration, TeamType } from '../types'
import * as db from '../lib/db'

interface AppDataContextValue {
  players: Player[]
  assignments: AudioAssignment[]
  savedPlaylists: SavedPlaylist[]
  addPlayer: (name: string, number: string, team: TeamType) => void
  updatePlayer: (player: Player, name: string, number: string, team: TeamType) => void
  removePlayer: (player: Player) => void
  addAssignment: (assignment: AudioAssignment) => void
  updateAssignment: (assignment: AudioAssignment) => void
  removeAssignment: (assignment: AudioAssignment) => void
  reorderPlaylist: (from: number[], to: number) => void
  normalizePlaylistOrder: () => void
  setPlaylistOrder: (assignment: AudioAssignment) => void
  saveCurrentPlaylist: (name: string) => void
  loadPlaylist: (playlist: SavedPlaylist) => void
  updatePlaylist: (playlist: SavedPlaylist) => void
  deletePlaylist: (playlist: SavedPlaylist) => void
  addAssignmentsToPlaylist: (assignments: AudioAssignment[], playlistName: string) => void
  addAssignmentsToCurrentPlaylist: (assignments: AudioAssignment[]) => void
  getReferencedFilePaths: () => Set<string>
  exportConfiguration: () => string
  importConfiguration: (json: string) => void
}

const AppDataContext = createContext<AppDataContextValue | null>(null)

function generateId() {
  return crypto.randomUUID()
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [players, setPlayers] = useState<Player[]>([])
  const [assignments, setAssignments] = useState<AudioAssignment[]>([])
  const [savedPlaylists, setSavedPlaylists] = useState<SavedPlaylist[]>([])
  const initRef = useRef(false)

  const loadData = useCallback(async () => {
    const [p, a, pl] = await Promise.all([
      db.getAllPlayers(),
      db.getAllAssignments(),
      db.getAllPlaylists()
    ])
    setPlayers(p.map(pr => ({ ...pr, team: pr.team ?? 'Varsity' })))
    setAssignments(a)
    setSavedPlaylists(pl)
  }, [])

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    loadData()
  }, [loadData])

  const persist = useCallback(async () => {
    await Promise.all([
      db.savePlayers(players),
      db.saveAssignments(assignments),
      db.savePlaylists(savedPlaylists)
    ])
  }, [players, assignments, savedPlaylists])

  useEffect(() => {
    if (players.length || assignments.length || savedPlaylists.length) {
      persist()
    }
  }, [players, assignments, savedPlaylists, persist])

  const addPlayer = useCallback((name: string, number: string, team: TeamType = 'Varsity') => {
    setPlayers(prev => [...prev, { id: generateId(), name, number, team }])
  }, [])

  const updatePlayer = useCallback((player: Player, name: string, number: string, team: TeamType) => {
    setPlayers(prev =>
      prev.map(p => (p.id === player.id ? { ...p, name, number, team } : p))
    )
  }, [])

  const removePlayer = useCallback((player: Player) => {
    setPlayers(prev => prev.filter(p => p.id !== player.id))
    setAssignments(prev => prev.filter(a => a.purpose !== 'Player Music' || a.player !== player.id))
  }, [])

  const addAssignment = useCallback((assignment: AudioAssignment) => {
    setAssignments(prev => [...prev, assignment])
  }, [])

  const updateAssignment = useCallback((assignment: AudioAssignment) => {
    setAssignments(prev =>
      prev.map(a => (a.id === assignment.id ? assignment : a))
    )
  }, [])

  const removeAssignment = useCallback((assignment: AudioAssignment) => {
    setAssignments(prev => prev.filter(a => a.id !== assignment.id))
  }, [])

  const reorderPlaylist = useCallback((from: number[], to: number) => {
    setAssignments(prev => {
      const playlistItems = prev
        .filter(a => a.purpose === 'In-Game Playlist')
        .sort((a, b) => (a.playlistOrder ?? 0) - (b.playlistOrder ?? 0))
      const [removed] = playlistItems.splice(from[0], 1)
      playlistItems.splice(to, 0, removed)
      const orderMap = new Map(playlistItems.map((item, i) => [item.id, i]))
      return prev.map(a => {
        const order = orderMap.get(a.id)
        return order !== undefined ? { ...a, playlistOrder: order } : a
      })
    })
  }, [])

  const normalizePlaylistOrder = useCallback(() => {
    setAssignments(prev => {
      const playlistItems = prev
        .filter(a => a.purpose === 'In-Game Playlist')
        .sort((a, b) => (a.playlistOrder ?? Infinity) - (b.playlistOrder ?? Infinity))
      const orderMap = new Map(playlistItems.map((item, i) => [item.id, i]))
      return prev.map(a => {
        const order = orderMap.get(a.id)
        return order !== undefined ? { ...a, playlistOrder: order } : a
      })
    })
  }, [])

  const setPlaylistOrder = useCallback((assignment: AudioAssignment) => {
    if (assignment.purpose !== 'In-Game Playlist') return
    setAssignments(prev => {
      const maxOrder = prev
        .filter(a => a.purpose === 'In-Game Playlist' && a.playlistOrder != null)
        .reduce((m, a) => Math.max(m, a.playlistOrder ?? 0), -1)
      return prev.map(a =>
        a.id === assignment.id ? { ...a, playlistOrder: maxOrder + 1 } : a
      )
    })
  }, [])

  const saveCurrentPlaylist = useCallback((name: string) => {
    const playlistItems = [...assignments]
      .filter(a => a.purpose === 'In-Game Playlist')
      .sort((a, b) => (a.playlistOrder ?? 0) - (b.playlistOrder ?? 0))
    const playlist: SavedPlaylist = {
      id: generateId(),
      name,
      assignments: playlistItems,
      createdAt: new Date().toISOString()
    }
    setSavedPlaylists(prev => [...prev, playlist])
  }, [assignments])

  const loadPlaylist = useCallback((playlist: SavedPlaylist) => {
    setAssignments(prev => {
      const nonPlaylist = prev.filter(a => a.purpose !== 'In-Game Playlist')
      const withOrder = playlist.assignments.map((a, i) => ({
        ...a,
        id: generateId(),
        playlistOrder: i
      }))
      return [...nonPlaylist, ...withOrder]
    })
  }, [])

  const updatePlaylist = useCallback((playlist: SavedPlaylist) => {
    setSavedPlaylists(prev =>
      prev.map(p => (p.id === playlist.id ? playlist : p))
    )
  }, [])

  const deletePlaylist = useCallback((playlist: SavedPlaylist) => {
    setSavedPlaylists(prev => prev.filter(p => p.id !== playlist.id))
  }, [])

  const addAssignmentsToPlaylist = useCallback(
    (newAssignments: AudioAssignment[], playlistName: string) => {
      const existing = savedPlaylists.find(p => p.name === playlistName)
      const maxOrder = existing
        ? Math.max(-1, ...existing.assignments.map(a => a.playlistOrder ?? 0))
        : -1
      const withOrder = newAssignments.map((a, i) => ({
        ...a,
        id: generateId(),
        playlistOrder: maxOrder + 1 + i
      }))
      if (existing) {
        setSavedPlaylists(prev =>
          prev.map(p =>
            p.name === playlistName
              ? { ...p, assignments: [...p.assignments, ...withOrder] }
              : p
          )
        )
      } else {
        setSavedPlaylists(prev => [
          ...prev,
          {
            id: generateId(),
            name: playlistName,
            assignments: withOrder,
            createdAt: new Date().toISOString()
          }
        ])
      }
    },
    [savedPlaylists]
  )

  const addAssignmentsToCurrentPlaylist = useCallback((newAssignments: AudioAssignment[]) => {
    setAssignments(prev => {
      const maxOrder = prev
        .filter(a => a.purpose === 'In-Game Playlist' && a.playlistOrder != null)
        .reduce((m, a) => Math.max(m, a.playlistOrder ?? 0), -1)
      const withOrder = newAssignments.map((a, i) => ({
        ...a,
        id: generateId(),
        purpose: 'In-Game Playlist' as const,
        playlistOrder: maxOrder + 1 + i
      }))
      return [...prev, ...withOrder]
    })
  }, [])

  const getReferencedFilePaths = useCallback(() => {
    return new Set(assignments.map(a => a.filePath))
  }, [assignments])

  const exportConfiguration = useCallback(() => {
    const config: AppConfiguration = {
      players,
      assignments,
      savedPlaylists,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    }
    return JSON.stringify(config, null, 2)
  }, [players, assignments, savedPlaylists])

  const importConfiguration = useCallback((json: string) => {
    const config: AppConfiguration = JSON.parse(json)
    setPlayers(config.players.map(p => ({ ...p, id: p.id || generateId() })))
    setAssignments(
      config.assignments.map(a => ({ ...a, id: a.id || generateId() }))
    )
    setSavedPlaylists(
      config.savedPlaylists.map(p => ({
        ...p,
        id: p.id || generateId(),
        assignments: p.assignments.map(a => ({ ...a, id: a.id || generateId() }))
      }))
    )
  }, [])

  const value: AppDataContextValue = {
    players,
    assignments,
    savedPlaylists,
    addPlayer,
    updatePlayer,
    removePlayer,
    addAssignment,
    updateAssignment,
    removeAssignment,
    reorderPlaylist,
    normalizePlaylistOrder,
    setPlaylistOrder,
    saveCurrentPlaylist,
    loadPlaylist,
    updatePlaylist,
    deletePlaylist,
    addAssignmentsToPlaylist,
    addAssignmentsToCurrentPlaylist,
    getReferencedFilePaths,
    exportConfiguration,
    importConfiguration
  }

  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  )
}

export function useAppData() {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider')
  return ctx
}

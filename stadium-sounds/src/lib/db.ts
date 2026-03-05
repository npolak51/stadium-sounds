import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import type { Player, AudioAssignment, SavedPlaylist } from '../types'

interface StadiumSoundsDB extends DBSchema {
  players: { key: string; value: Player }
  assignments: { key: string; value: AudioAssignment }
  playlists: { key: string; value: SavedPlaylist }
}

const DB_NAME = 'stadium-sounds-db'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<StadiumSoundsDB>> | null = null

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<StadiumSoundsDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('players')) {
          db.createObjectStore('players', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('assignments')) {
          db.createObjectStore('assignments', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('playlists')) {
          db.createObjectStore('playlists', { keyPath: 'id' })
        }
      }
    })
  }
  return dbPromise
}

export async function getAllPlayers(): Promise<Player[]> {
  const db = await getDB()
  return db.getAll('players')
}

export async function savePlayers(players: Player[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('players', 'readwrite')
  await tx.store.clear()
  for (const p of players) {
    await tx.store.put(p)
  }
  await tx.done
}

export async function getAllAssignments(): Promise<AudioAssignment[]> {
  const db = await getDB()
  return db.getAll('assignments')
}

export async function saveAssignments(assignments: AudioAssignment[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('assignments', 'readwrite')
  await tx.store.clear()
  for (const a of assignments) {
    await tx.store.put(a)
  }
  await tx.done
}

export async function getAllPlaylists(): Promise<SavedPlaylist[]> {
  const db = await getDB()
  return db.getAll('playlists')
}

export async function savePlaylists(playlists: SavedPlaylist[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('playlists', 'readwrite')
  await tx.store.clear()
  for (const p of playlists) {
    await tx.store.put(p)
  }
  await tx.done
}

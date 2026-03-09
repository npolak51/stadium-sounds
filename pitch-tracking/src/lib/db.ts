import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import type { Game, Pitcher, Batter } from '../types'

export interface PitchTrackingDB extends DBSchema {
  games: {
    key: string
    value: Game
    indexes: { 'by-date': string; 'by-pitcher': string }
  }
  pitchers: {
    key: string
    value: Pitcher
    indexes: { 'by-name': string }
  }
  batters: {
    key: string
    value: Batter
    indexes: { 'by-name': string }
  }
}

const DB_NAME = 'pitch-tracking-db'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<PitchTrackingDB>> | null = null

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<PitchTrackingDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const gamesStore = db.createObjectStore('games', { keyPath: 'id' })
        gamesStore.createIndex('by-date', 'date')
        gamesStore.createIndex('by-pitcher', 'pitcherId')

        const pitchersStore = db.createObjectStore('pitchers', { keyPath: 'id' })
        pitchersStore.createIndex('by-name', 'name')

        const battersStore = db.createObjectStore('batters', { keyPath: 'id' })
        battersStore.createIndex('by-name', 'name')
      },
    })
  }
  return dbPromise
}

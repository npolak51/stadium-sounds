import { getDB } from './db'
import { getAllGames, getAllPitchers } from './storage'
import type { Game, Pitcher, Batter } from '../types'

const BACKUP_VERSION = 1

export interface BackupData {
  version: number
  exportedAt: string
  games: Game[]
  pitchers: Pitcher[]
  batters: Batter[]
}

function isGame(obj: unknown): obj is Game {
  if (!obj || typeof obj !== 'object') return false
  const g = obj as Record<string, unknown>
  return (
    typeof g.id === 'string' &&
    typeof g.date === 'string' &&
    typeof g.opponent === 'string' &&
    typeof g.pitcherId === 'string' &&
    typeof g.isComplete === 'boolean' &&
    Array.isArray(g.atBats)
  )
}

function isPitcher(obj: unknown): obj is Pitcher {
  if (!obj || typeof obj !== 'object') return false
  const p = obj as Record<string, unknown>
  return typeof p.id === 'string' && typeof p.name === 'string'
}

function isBatter(obj: unknown): obj is Batter {
  if (!obj || typeof obj !== 'object') return false
  const b = obj as Record<string, unknown>
  return typeof b.id === 'string' && typeof b.name === 'string'
}

export async function exportBackup(): Promise<BackupData> {
  const [games, pitchers] = await Promise.all([getAllGames(), getAllPitchers()])
  const db = await getDB()
  const batters = await db.getAll('batters')

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    games,
    pitchers,
    batters,
  }
}

export function downloadBackup(data: BackupData, filename?: string): void {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename ?? `pitch-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}

export async function importBackup(data: unknown): Promise<{ success: boolean; error?: string }> {
  try {
    if (!data || typeof data !== 'object') {
      return { success: false, error: 'Invalid backup file' }
    }

    const backup = data as Record<string, unknown>
    const games = backup.games
    const pitchers = backup.pitchers
    const batters = backup.batters

    if (!Array.isArray(games) || !Array.isArray(pitchers) || !Array.isArray(batters)) {
      return { success: false, error: 'Invalid backup format' }
    }

    const validGames = games.filter(isGame)
    const validPitchers = pitchers.filter(isPitcher)
    const validBatters = batters.filter(isBatter)

    if (validGames.length !== games.length || validPitchers.length !== pitchers.length) {
      return { success: false, error: 'Backup contains invalid data' }
    }

    const db = await getDB()
    const tx = db.transaction(['games', 'pitchers', 'batters'], 'readwrite')

    await tx.objectStore('games').clear()
    await tx.objectStore('pitchers').clear()
    await tx.objectStore('batters').clear()

    for (const game of validGames) {
      await tx.objectStore('games').put(game)
    }
    for (const pitcher of validPitchers) {
      await tx.objectStore('pitchers').put(pitcher)
    }
    for (const batter of validBatters) {
      await tx.objectStore('batters').put(batter)
    }

    await tx.done
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to restore backup',
    }
  }
}

export function parseBackupFile(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string)
        resolve(data)
      } catch {
        reject(new Error('Invalid JSON file'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

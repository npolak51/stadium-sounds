import { getDB } from './db'
import type { Game, Pitcher, Batter } from '../types'

function wrapStorageError(err: unknown, operation: string): Error {
  if (err instanceof Error) {
    if (err.name === 'QuotaExceededError') {
      return new Error('Storage full. Try removing old data or clearing space.')
    }
    if (err.name === 'UnknownError' || err.message?.includes('database')) {
      return new Error(`Storage error. ${operation} failed. Try again.`)
    }
    return err
  }
  return new Error(`${operation} failed. Please try again.`)
}

export async function saveGame(game: Game): Promise<void> {
  try {
    const db = await getDB()
    await db.put('games', game)
  } catch (err) {
    throw wrapStorageError(err, 'Save game')
  }
}

export async function getGame(id: string): Promise<Game | undefined> {
  const db = await getDB()
  return db.get('games', id)
}

export async function getAllGames(): Promise<Game[]> {
  const db = await getDB()
  return db.getAll('games')
}

export async function deleteGame(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('games', id)
}

export async function getGamesByPitcher(pitcherId: string): Promise<Game[]> {
  const db = await getDB()
  return db.getAllFromIndex('games', 'by-pitcher', pitcherId)
}

export async function getGamesWherePitcherAppeared(pitcherId: string): Promise<Game[]> {
  const games = await getAllGames()
  return games.filter(
    (g) =>
      g.isComplete &&
      g.atBats.some((ab) => ab.pitcherId === pitcherId)
  )
}

export async function getGamesByDate(date: string): Promise<Game[]> {
  const db = await getDB()
  return db.getAllFromIndex('games', 'by-date', date)
}

export async function savePitcher(pitcher: Pitcher): Promise<void> {
  try {
    const db = await getDB()
    await db.put('pitchers', pitcher)
  } catch (err) {
    throw wrapStorageError(err, 'Save pitcher')
  }
}

export async function getPitcher(id: string): Promise<Pitcher | undefined> {
  const db = await getDB()
  return db.get('pitchers', id)
}

export async function getAllPitchers(): Promise<Pitcher[]> {
  const db = await getDB()
  return db.getAll('pitchers')
}

export async function deletePitcher(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('pitchers', id)
}

export async function saveBatter(batter: Batter): Promise<void> {
  try {
    const db = await getDB()
    await db.put('batters', batter)
  } catch (err) {
    throw wrapStorageError(err, 'Save batter')
  }
}

export async function getBatter(id: string): Promise<Batter | undefined> {
  const db = await getDB()
  return db.get('batters', id)
}

export function generateId(): string {
  return crypto.randomUUID()
}

import { getDB } from './db'
import type { Game, Pitcher, Batter } from '../types'

export async function saveGame(game: Game): Promise<void> {
  const db = await getDB()
  await db.put('games', game)
}

export async function getGame(id: string): Promise<Game | undefined> {
  const db = await getDB()
  return db.get('games', id)
}

export async function getAllGames(): Promise<Game[]> {
  const db = await getDB()
  return db.getAll('games')
}

export async function getGamesByPitcher(pitcherId: string): Promise<Game[]> {
  const db = await getDB()
  return db.getAllFromIndex('games', 'by-pitcher', pitcherId)
}

export async function getGamesByDate(date: string): Promise<Game[]> {
  const db = await getDB()
  return db.getAllFromIndex('games', 'by-date', date)
}

export async function savePitcher(pitcher: Pitcher): Promise<void> {
  const db = await getDB()
  await db.put('pitchers', pitcher)
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
  const db = await getDB()
  await db.put('batters', batter)
}

export async function getBatter(id: string): Promise<Batter | undefined> {
  const db = await getDB()
  return db.get('batters', id)
}

export function generateId(): string {
  return crypto.randomUUID()
}

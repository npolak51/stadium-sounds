import { describe, it, expect, beforeEach } from 'vitest'
import type { Game, Pitcher, Batter } from '../types'
import {
  saveGame,
  getGame,
  getAllGames,
  deleteGame,
  savePitcher,
  getPitcher,
  getAllPitchers,
  deletePitcher,
  saveBatter,
  getBatter,
  generateId,
} from './storage'
import { clearAllForTesting } from './db'

function createGame(overrides?: Partial<Game>): Game {
  return {
    id: generateId(),
    date: '2025-01-15',
    opponent: 'Opponent',
    pitcherId: 'p1',
    pitcher: { id: 'p1', name: 'Pitcher' },
    isComplete: false,
    atBats: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('storage', () => {
  beforeEach(async () => {
    await clearAllForTesting()
  })

  describe('generateId', () => {
    it('generates unique IDs', () => {
      const ids = new Set([...Array(100)].map(() => generateId()))
      expect(ids.size).toBe(100)
    })
  })

  describe('game operations', () => {
    it('saves and retrieves a game', async () => {
      const game = createGame()
      await saveGame(game)
      const retrieved = await getGame(game.id)
      expect(retrieved).toEqual(game)
    })

    it('getAllGames returns all games', async () => {
      const game1 = createGame()
      const game2 = createGame()
      await saveGame(game1)
      await saveGame(game2)
      const all = await getAllGames()
      expect(all).toHaveLength(2)
    })

    it('deleteGame removes a game', async () => {
      const game = createGame()
      await saveGame(game)
      await deleteGame(game.id)
      const retrieved = await getGame(game.id)
      expect(retrieved).toBeUndefined()
    })
  })

  describe('pitcher operations', () => {
    it('saves and retrieves a pitcher', async () => {
      const pitcher: Pitcher = { id: 'p1', name: 'Test Pitcher', jerseyNumber: '12' }
      await savePitcher(pitcher)
      const retrieved = await getPitcher('p1')
      expect(retrieved).toEqual(pitcher)
    })

    it('getAllPitchers returns all pitchers', async () => {
      await savePitcher({ id: 'p1', name: 'Pitcher 1' })
      await savePitcher({ id: 'p2', name: 'Pitcher 2' })
      const all = await getAllPitchers()
      expect(all).toHaveLength(2)
    })

    it('deletePitcher removes a pitcher', async () => {
      await savePitcher({ id: 'p1', name: 'Pitcher 1' })
      await deletePitcher('p1')
      const retrieved = await getPitcher('p1')
      expect(retrieved).toBeUndefined()
    })
  })

  describe('batter operations', () => {
    it('saves and retrieves a batter', async () => {
      const batter: Batter = { id: 'b1', name: 'Test Batter', jerseyNumber: '5' }
      await saveBatter(batter)
      const retrieved = await getBatter('b1')
      expect(retrieved).toEqual(batter)
    })
  })
})

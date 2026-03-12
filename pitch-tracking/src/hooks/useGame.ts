import { useState, useEffect, useCallback } from 'react'
import type { Game, AtBat, Pitch, Batter, LineupBatter } from '../types'
import { getGame, saveGame, saveBatter, getPitcher, generateId } from '../lib/storage'

function defaultLineup(game: Game) {
  if (game.opposingLineup?.length) return game.opposingLineup
  return Array.from({ length: 9 }, (_, i) => ({
    order: i + 1,
    originalBatter: {} as LineupBatter,
    currentBatter: {} as LineupBatter,
  }))
}

export function useGame(gameId: string | null) {
  const [game, setGame] = useState<Game | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!gameId) {
      setGame(null)
      setLoading(false)
      setError(null)
      return
    }
    setError(null)
    getGame(gameId)
      .then((g) => {
        if (g && !g.opposingLineup?.length) {
          g = { ...g, opposingLineup: defaultLineup(g as Game) }
        }
        setGame(g ?? null)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load game')
        setLoading(false)
      })
  }, [gameId])

  const saveGameSafe = useCallback(async (updated: Game) => {
    setSaveError(null)
    try {
      await saveGame(updated)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
      throw err
    }
  }, [])

  const updateGame = useCallback(async (updates: Partial<Game>) => {
    if (!game) return
    const updated = { ...game, ...updates }
    setGame(updated)
    await saveGameSafe(updated)
  }, [game, saveGameSafe])

  const addAtBat = useCallback(
    async (
      batter: Batter,
      inning: number,
      isTopInning: boolean,
      lineupSlotOrder: number,
      isOriginalStarter: boolean
    ) => {
      if (!game) return
      await saveBatter(batter)
      const lineup = defaultLineup(game)
      const slotIndex = lineup.findIndex((s) => s.order === lineupSlotOrder)
      if (slotIndex >= 0) {
        lineup[slotIndex] = {
          ...lineup[slotIndex],
          currentBatter: {
            name: batter.name || undefined,
            jerseyNumber: batter.jerseyNumber,
          },
        }
      }
      const atBat: AtBat = {
        id: generateId(),
        gameId: game.id,
        batterId: batter.id,
        batter,
        pitcherId: game.pitcherId,
        inning,
        isTopInning,
        lineupSlotOrder,
        isOriginalStarter,
        pitches: [],
        timestamp: new Date().toISOString(),
      }
      const atBats = [...game.atBats, atBat]
      const updated = { ...game, atBats, opposingLineup: lineup }
      setGame(updated)
      await saveGameSafe(updated)
      return atBat
    },
    [game, saveGameSafe]
  )

  const substituteBatter = useCallback(
    async (atBatId: string, newBatter: { name?: string; jerseyNumber?: string }) => {
      if (!game) return
      const atBat = game.atBats.find((a) => a.id === atBatId)
      if (!atBat) return

      const batter: Batter = {
        id: generateId(),
        name: newBatter.name ?? '',
        jerseyNumber: newBatter.jerseyNumber,
      }
      await saveBatter(batter)

      const lineup = defaultLineup(game)
      const slotIndex = lineup.findIndex((s) => s.order === (atBat.lineupSlotOrder ?? 1))
      if (slotIndex >= 0) {
        lineup[slotIndex] = {
          ...lineup[slotIndex],
          currentBatter: {
            name: newBatter.name,
            jerseyNumber: newBatter.jerseyNumber,
          },
        }
      }

      const atBats = game.atBats.map((a) =>
        a.id === atBatId
          ? { ...a, batter, batterId: batter.id, isOriginalStarter: false }
          : a
      )
      const updated = { ...game, atBats, opposingLineup: lineup }
      setGame(updated)
      await saveGameSafe(updated)
    },
    [game, saveGameSafe]
  )

  const replaceBatterWithOriginal = useCallback(
    async (atBatId: string) => {
      if (!game) return
      const atBat = game.atBats.find((a) => a.id === atBatId)
      if (!atBat) return

      const lineup = defaultLineup(game)
      const slot = lineup.find((s) => s.order === (atBat.lineupSlotOrder ?? 1))
      if (!slot) return

      const batter: Batter = {
        id: generateId(),
        name: slot.originalBatter.name ?? '',
        jerseyNumber: slot.originalBatter.jerseyNumber,
      }
      await saveBatter(batter)

      const slotIndex = lineup.findIndex((s) => s.order === (atBat.lineupSlotOrder ?? 1))
      if (slotIndex >= 0) {
        lineup[slotIndex] = {
          ...lineup[slotIndex],
          currentBatter: { ...slot.originalBatter },
        }
      }

      const atBats = game.atBats.map((a) =>
        a.id === atBatId
          ? { ...a, batter, batterId: batter.id, isOriginalStarter: true }
          : a
      )
      const updated = { ...game, atBats, opposingLineup: lineup }
      setGame(updated)
      await saveGameSafe(updated)
    },
    [game, saveGameSafe]
  )

  const addPitch = useCallback(
    async (
      atBatId: string,
      data: {
        pitchType: Pitch['pitchType']
        result: Pitch['result']
        countBefore?: { balls: number; strikes: number }
        contactTrajectory?: Pitch['contactTrajectory']
        contactType?: Pitch['contactType']
        hitLocation?: Pitch['hitLocation']
        timing?: Pitch['timing']
      }
    ) => {
      if (!game) return
      const atBat = game.atBats.find((a) => a.id === atBatId)
      if (!atBat) return

      const pitch: Pitch = {
        id: generateId(),
        gameId: game.id,
        atBatId,
        pitchType: data.pitchType,
        result: data.result,
        countBefore: data.countBefore,
        sequenceIndex: atBat.pitches.length,
        timestamp: new Date().toISOString(),
        contactTrajectory: data.contactTrajectory,
        contactType: data.contactType,
        hitLocation: data.hitLocation,
        timing: data.timing,
      }

      const atBats = game.atBats.map((a) =>
        a.id === atBatId ? { ...a, pitches: [...a.pitches, pitch] } : a
      )
      const updated = { ...game, atBats }
      setGame(updated)
      await saveGameSafe(updated)
      return { pitch, updatedGame: updated }
    },
    [game, saveGameSafe]
  )

  const completeAtBat = useCallback(
    async (atBatId: string, result: AtBat['result'], gameToUse?: Game) => {
      const baseGame = gameToUse ?? game
      if (!baseGame) return
      const atBats = baseGame.atBats.map((a) =>
        a.id === atBatId ? { ...a, result } : a
      )
      const updated = { ...baseGame, atBats }
      setGame(updated)
      await saveGameSafe(updated)
    },
    [game, saveGameSafe]
  )

  const completeGame = useCallback(async () => {
    if (!game) return
    const updated = { ...game, isComplete: true }
    setGame(updated)
    await saveGameSafe(updated)
  }, [game, saveGameSafe])

  const removeLastPitch = useCallback(
    async (atBatId?: string): Promise<string | null> => {
      if (!game || game.atBats.length === 0) return null
      const targetAtBat = atBatId
        ? game.atBats.find((a) => a.id === atBatId)
        : game.atBats[game.atBats.length - 1]
      if (!targetAtBat || targetAtBat.pitches.length === 0) return null

      const newPitches = targetAtBat.pitches.slice(0, -1)
      const hadResult = targetAtBat.result != null
      const atBats = game.atBats.map((a) =>
        a.id === targetAtBat.id
          ? { ...a, pitches: newPitches, result: undefined }
          : a
      )
      const updated = { ...game, atBats }
      setGame(updated)
      await saveGameSafe(updated)
      return hadResult ? targetAtBat.id : null
    },
    [game, saveGameSafe]
  )

  const changePitcher = useCallback(
    async (pitcherId: string) => {
      if (!game) return
      const pitcher = await getPitcher(pitcherId)
      if (!pitcher) return
      const updated = { ...game, pitcherId, pitcher }
      setGame(updated)
      await saveGameSafe(updated)
    },
    [game, saveGameSafe]
  )

  const clearSaveError = useCallback(() => setSaveError(null), [])

  return {
    game,
    loading,
    error,
    saveError,
    clearSaveError,
    updateGame,
    addAtBat,
    addPitch,
    completeAtBat,
    completeGame,
    substituteBatter,
    replaceBatterWithOriginal,
    removeLastPitch,
    changePitcher,
  }
}

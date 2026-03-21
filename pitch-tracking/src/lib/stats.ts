import type { Game, AtBat, Pitch, PitchType, AtBatResult, HitLocation, ContactTrajectory } from '../types'
import { PITCH_ABBREV, PITCH_TYPES } from './constants'

export { PITCH_ABBREV }

export function formatPitchSequence(pitches: Pitch[]): string {
  const sorted = [...pitches].sort((a, b) => a.sequenceIndex - b.sequenceIndex)
  return sorted.map((p) => PITCH_ABBREV[p.pitchType] ?? '?').join(', ')
}

function isStrike(result: string): boolean {
  return (
    result === 'whiff' ||
    result === 'called_strike' ||
    result === 'foul'
  )
}

function isStrikeResult(result: string): boolean {
  return (
    result === 'whiff' ||
    result === 'called_strike' ||
    result === 'foul' ||
    result === 'in_play'
  )
}

const OFFSPEED_TYPES: PitchType[] = ['curveball', 'slider', 'changeup', 'cutter', 'splitter']

function isOffspeed(pitchType: string): boolean {
  return OFFSPEED_TYPES.includes(pitchType as PitchType)
}

export function getPitchStatsByType(
  game: Game
): Record<PitchType, { thrown: number; strikes: number; balls: number; contact: number }> {
  const stats: Record<
    string,
    { thrown: number; strikes: number; balls: number; contact: number }
  > = {}

  PITCH_TYPES.forEach((pt) => {
    stats[pt] = { thrown: 0, strikes: 0, balls: 0, contact: 0 }
  })

  for (const atBat of game.atBats) {
    for (const pitch of atBat.pitches) {
      const s = stats[pitch.pitchType] ?? stats.fastball
      s.thrown++
      if (isStrike(pitch.result)) {
        s.strikes++
      } else if (pitch.result === 'ball') {
        s.balls++
      }
      if (pitch.result === 'in_play') {
        s.contact++
      }
    }
  }

  return stats as Record<
    PitchType,
    { thrown: number; strikes: number; balls: number; contact: number }
  >
}

function sameBatter(a: { name?: string; jerseyNumber?: string }, b: { name?: string; jerseyNumber?: string }): boolean {
  return (a.name ?? '') === (b.name ?? '') && (a.jerseyNumber ?? '') === (b.jerseyNumber ?? '')
}

export function getBatterLastAtBat(
  game: Game,
  currentBatter: { name?: string; jerseyNumber?: string },
  excludeAtBatId?: string
): AtBat | undefined {
  const batterAtBats = game.atBats
    .filter(
      (a) =>
        a.id !== excludeAtBatId &&
        sameBatter(a.batter, currentBatter)
    )
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  return batterAtBats[0]
}

export function getBatterAllPreviousAtBats(
  game: Game,
  currentBatter: { name?: string; jerseyNumber?: string },
  excludeAtBatId?: string
): AtBat[] {
  return game.atBats
    .filter(
      (a) =>
        a.id !== excludeAtBatId &&
        sameBatter(a.batter, currentBatter)
    )
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
}

export function getBatterPreviousAtBats(game: Game, batterId: string): AtBat[] {
  return game.atBats
    .filter((a) => a.batterId === batterId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

export interface ContactPoint {
  location: HitLocation
  trajectory: ContactTrajectory
}

export function getBatterContactPoints(
  game: Game,
  batter: { name?: string; jerseyNumber?: string },
  excludeAtBatId?: string
): ContactPoint[] {
  const points: ContactPoint[] = []
  for (const ab of game.atBats) {
    if (ab.id === excludeAtBatId || !sameBatter(ab.batter, batter)) continue
    for (const p of ab.pitches) {
      if (
        (p.result === 'foul' || p.result === 'in_play') &&
        p.contactTrajectory &&
        p.hitLocation
      ) {
        points.push({ location: p.hitLocation, trajectory: p.contactTrajectory })
      }
    }
  }
  return points
}

export function getAtBatContactPoints(atBat: AtBat): ContactPoint[] {
  const points: ContactPoint[] = []
  for (const p of atBat.pitches) {
    if (
      (p.result === 'foul' || p.result === 'in_play') &&
      p.contactTrajectory &&
      p.hitLocation
    ) {
      points.push({ location: p.hitLocation, trajectory: p.contactTrajectory })
    }
  }
  return points
}

export function getPitchersInGame(game: Game): { pitcherId: string; atBatCount: number }[] {
  const byPitcher = new Map<string, number>()
  for (const ab of game.atBats) {
    const count = byPitcher.get(ab.pitcherId) ?? 0
    byPitcher.set(ab.pitcherId, count + 1)
  }
  return Array.from(byPitcher.entries())
    .map(([pitcherId, atBatCount]) => ({ pitcherId, atBatCount }))
    .sort((a, b) => b.atBatCount - a.atBatCount)
}

export function getGameFilteredByPitcher(game: Game, pitcherId: string): Game {
  return {
    ...game,
    atBats: game.atBats.filter((ab) => ab.pitcherId === pitcherId),
  }
}

export function getGameContactPoints(game: Game): ContactPoint[] {
  const points: ContactPoint[] = []
  for (const ab of game.atBats) {
    for (const p of ab.pitches) {
      if (
        (p.result === 'foul' || p.result === 'in_play') &&
        p.contactTrajectory &&
        p.hitLocation
      ) {
        points.push({ location: p.hitLocation, trajectory: p.contactTrajectory })
      }
    }
  }
  return points
}

export function getGamesContactPoints(games: Game[]): ContactPoint[] {
  return games.flatMap(getGameContactPoints)
}

/** Contact points from games, filtered to only at-bats for the given pitcher */
export function getGamesContactPointsForPitcher(games: Game[], pitcherId: string): ContactPoint[] {
  return games.flatMap((g) => getGameContactPoints(getGameFilteredByPitcher(g, pitcherId)))
}

export function getContactTypeCounts(
  game: Game
): Record<string, number> {
  const counts: Record<string, number> = { hard: 0, average: 0, weak: 0, bunt: 0 }
  for (const ab of game.atBats) {
    for (const p of ab.pitches) {
      if ((p.result === 'foul' || p.result === 'in_play') && p.contactType) {
        const key = (p.contactType as string) === 'normal' ? 'average' : p.contactType
        counts[key] = (counts[key] ?? 0) + 1
      }
    }
  }
  return counts
}

export function getContactTrajectoryCounts(
  game: Game
): Record<string, number> {
  const counts: Record<string, number> = { groundball: 0, line_drive: 0, flyball: 0, pop_up: 0 }
  for (const ab of game.atBats) {
    for (const p of ab.pitches) {
      if ((p.result === 'foul' || p.result === 'in_play') && p.contactTrajectory) {
        counts[p.contactTrajectory] = (counts[p.contactTrajectory] ?? 0) + 1
      }
    }
  }
  return counts
}

export function getCurrentCount(atBat: AtBat): { balls: number; strikes: number } {
  let balls = 0
  let strikes = 0
  for (const p of atBat.pitches) {
    if (p.result === 'ball') balls++
    else if (isStrike(p.result)) strikes++
  }
  return { balls, strikes }
}

export function formatAtBatResult(result?: AtBatResult): string {
  if (!result) return '—'
  const map: Record<AtBatResult, string> = {
    hit: 'Hit',
    out: 'Out',
    strikeout: 'K',
    walk: 'BB',
    error: 'E',
    catchers_interference: "CI",
  }
  return map[result] ?? result
}

export function getOutsFromResult(result?: AtBatResult): number {
  if (!result) return 0
  if (result === 'out' || result === 'strikeout') return 1
  return 0
}

export function getTotalOuts(game: Game): number {
  return game.atBats.reduce(
    (sum, ab) => sum + getOutsFromResult(ab.result),
    0
  )
}

export function getOutsInInning(
  game: Game,
  inning: number,
  isTopInning: boolean
): number {
  return game.atBats.reduce((sum, ab) => {
    if (ab.inning === inning && ab.isTopInning === isTopInning) {
      return sum + getOutsFromResult(ab.result)
    }
    return sum
  }, 0)
}

export function getInningsPitched(game: Game): number {
  const outs = getTotalOuts(game)
  return Math.floor(outs / 3) + (outs % 3) / 3
}

export function getWalks(game: Game): number {
  return game.atBats.filter((ab) => ab.result === 'walk').length
}

export function getStrikeouts(game: Game): number {
  return game.atBats.filter((ab) => ab.result === 'strikeout').length
}

/** Last pitch type used on each strikeout: { pitchType: count } */
export function getStrikeoutPitchTypes(game: Game): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const ab of game.atBats) {
    if (ab.result !== 'strikeout' || ab.pitches.length === 0) continue
    const lastPitch = ab.pitches.sort((a, b) => a.sequenceIndex - b.sequenceIndex).at(-1)
    if (lastPitch) {
      counts[lastPitch.pitchType] = (counts[lastPitch.pitchType] ?? 0) + 1
    }
  }
  return counts
}

/** Count of non-fastball pitches that were strikes */
export function getOffspeedStrikes(game: Game): number {
  let count = 0
  for (const ab of game.atBats) {
    for (const p of ab.pitches) {
      if (isOffspeed(p.pitchType) && isStrikeResult(p.result)) count++
    }
  }
  return count
}

/** Count of first pitches that were offspeed and strikes */
export function getOffspeedFirstPitchStrikes(game: Game): number {
  let count = 0
  for (const ab of game.atBats) {
    if (ab.pitches.length === 0) continue
    const first = ab.pitches[0]
    if (isOffspeed(first.pitchType) && isStrikeResult(first.result)) count++
  }
  return count
}

export function getHits(game: Game): number {
  return game.atBats.filter((ab) => ab.result === 'hit').length
}

export function getWHIP(game: Game): string {
  const innings = getInningsPitched(game)
  if (innings === 0) return '—'
  const whip = (getWalks(game) + getHits(game)) / innings
  return whip.toFixed(2)
}

export function getFirstPitchStrikePct(game: Game): string {
  const atBatsWithPitch = game.atBats.filter((ab) => ab.pitches.length > 0)
  if (atBatsWithPitch.length === 0) return '—'
  const firstPitchStrikes = atBatsWithPitch.filter((ab) => {
    const first = ab.pitches[0]
    return (
      first.result === 'whiff' ||
      first.result === 'called_strike' ||
      first.result === 'foul' ||
      first.result === 'in_play'
    )
  }).length
  return (((firstPitchStrikes / atBatsWithPitch.length) * 100).toFixed(1))
}

export function getSwingAndMissRateByType(
  game: Game
): Record<string, { swings: number; whiffs: number; rate: string }> {
  const byType: Record<string, { swings: number; whiffs: number }> = {}
  for (const ab of game.atBats) {
    for (const p of ab.pitches) {
      const swung = p.result === 'whiff' || p.result === 'foul' || p.result === 'in_play'
      if (!swung) continue
      if (!byType[p.pitchType]) byType[p.pitchType] = { swings: 0, whiffs: 0 }
      byType[p.pitchType].swings++
      if (p.result === 'whiff') byType[p.pitchType].whiffs++
    }
  }
  return Object.fromEntries(
    Object.entries(byType).map(([type, s]) => [
      type,
      {
        ...s,
        rate: s.swings > 0 ? ((s.whiffs / s.swings) * 100).toFixed(1) : '—',
      },
    ])
  )
}

export function getBAA(game: Game): string {
  const officialABs = game.atBats.filter(
    (ab) =>
      ab.result === 'hit' ||
      ab.result === 'out' ||
      ab.result === 'strikeout' ||
      ab.result === 'error'
  )
  if (officialABs.length === 0) return '—'
  const hits = game.atBats.filter((ab) => ab.result === 'hit').length
  return (hits / officialABs.length).toFixed(3)
}

export function getPitchesPerBatter(game: Game): string {
  if (game.atBats.length === 0) return '—'
  const totalPitches = game.atBats.reduce((s, ab) => s + ab.pitches.length, 0)
  return (totalPitches / game.atBats.length).toFixed(1)
}

export function getPerInningStats(
  game: Game
): { inning: number; isTopInning: boolean; pitches: number; strikes: number }[] {
  const byInning = new Map<string, { pitches: number; strikes: number }>()
  for (const ab of game.atBats) {
    const key = `${ab.inning}-${ab.isTopInning}`
    const current = byInning.get(key) ?? { pitches: 0, strikes: 0 }
    for (const p of ab.pitches) {
      current.pitches++
      if (isStrike(p.result)) current.strikes++
    }
    byInning.set(key, current)
  }
  return Array.from(byInning.entries())
    .map(([key, s]) => {
      const [inning, isTop] = key.split('-')
      return {
        inning: parseInt(inning, 10),
        isTopInning: isTop === 'true',
        pitches: s.pitches,
        strikes: s.strikes,
      }
    })
    .sort((a, b) => {
      if (a.inning !== b.inning) return a.inning - b.inning
      return a.isTopInning ? -1 : 1
    })
}

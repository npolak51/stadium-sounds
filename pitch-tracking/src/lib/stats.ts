import type { Game, AtBat, PitchType, AtBatResult } from '../types'

const PITCH_TYPES: PitchType[] = [
  'fastball',
  'curveball',
  'slider',
  'changeup',
  'cutter',
  'splitter',
]

function isStrike(result: string): boolean {
  return (
    result === 'whiff' ||
    result === 'called_strike' ||
    result === 'foul'
  )
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

export function getBatterPreviousAtBats(game: Game, batterId: string): AtBat[] {
  return game.atBats
    .filter((a) => a.batterId === batterId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
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

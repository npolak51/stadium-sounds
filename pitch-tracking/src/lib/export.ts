import type { Game } from '../types'
import {
  getPitchStatsByType,
  formatAtBatResult,
  getInningsPitched,
  getWHIP,
  getFirstPitchStrikePct,
  getBAA,
  getPitchesPerBatter,
} from './stats'

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function gameToCSV(game: Game): string {
  const pitchStats = getPitchStatsByType(game)
  const totalPitches = game.atBats.reduce((sum, ab) => sum + ab.pitches.length, 0)
  const totalStrikes = game.atBats.reduce(
    (sum, ab) =>
      sum +
      ab.pitches.filter(
        (p) =>
          p.result === 'whiff' ||
          p.result === 'called_strike' ||
          p.result === 'foul' ||
          p.result === 'in_play'
      ).length,
    0
  )
  const strikePct =
    totalPitches > 0 ? ((totalStrikes / totalPitches) * 100).toFixed(1) : '0'

  const rows: string[] = []

  rows.push('Pitch Tracker - Game Report')
  rows.push('')
  rows.push(
    [
      'Pitcher',
      'Opponent',
      'Date',
      'Location',
      'Total Pitches',
      'Strike %',
      'Batters Faced',
      'Innings',
      'WHIP',
      '1st Pitch Strike %',
      'BAA',
      'Pitches/Batter',
    ].map(escapeCSV).join(',')
  )
  rows.push(
    [
      game.pitcher.name,
      game.opponent,
      game.date,
      game.location ?? '',
      totalPitches,
      strikePct,
      game.atBats.length,
      getInningsPitched(game).toFixed(1),
      getWHIP(game),
      getFirstPitchStrikePct(game),
      getBAA(game),
      getPitchesPerBatter(game),
    ].map(String).map(escapeCSV).join(',')
  )
  rows.push('')
  rows.push('Pitch Breakdown')
  rows.push(['Pitch', 'Thrown', 'Strikes', 'Balls', 'Strike %'].map(escapeCSV).join(','))

  const pitchRows = Object.entries(pitchStats)
    .filter(([, s]) => s.thrown > 0)
    .sort((a, b) => b[1].thrown - a[1].thrown)

  for (const [type, s] of pitchRows) {
    const pct = s.thrown > 0 ? ((s.strikes / s.thrown) * 100).toFixed(1) : '0'
    rows.push([type, s.thrown, s.strikes, s.balls, `${pct}%`].map(String).map(escapeCSV).join(','))
  }
  rows.push('')
  rows.push('At-Bats')
  rows.push(['#', 'Batter', 'Result', 'Pitches'].map(escapeCSV).join(','))

  game.atBats.forEach((ab, i) => {
    const batterName =
      ab.batter.name || ab.batter.jerseyNumber
        ? `${ab.batter.name || ''}${ab.batter.jerseyNumber ? ` #${ab.batter.jerseyNumber}` : ''}`.trim()
        : 'Batter'
    rows.push(
      [
        i + 1,
        batterName,
        formatAtBatResult(ab.result),
        ab.pitches.length,
      ].map(String).map(escapeCSV).join(',')
    )
  })

  return rows.join('\n')
}

export function pitcherReportToCSV(
  pitcherName: string,
  games: Game[]
): string {
  const rows: string[] = []
  rows.push(`Pitch Tracker - Pitcher Report: ${pitcherName}`)
  rows.push(`Games: ${games.length}`)
  rows.push('')

  for (const game of games) {
    rows.push(`Game: ${game.date} vs ${game.opponent}`)
    rows.push(gameToCSV(game))
    rows.push('')
    rows.push('---')
    rows.push('')
  }

  return rows.join('\n')
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

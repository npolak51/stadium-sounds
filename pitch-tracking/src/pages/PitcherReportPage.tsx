import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getGamesByPitcher, getPitcher } from '../lib/storage'
import { getPitchStatsByType } from '../lib/stats'
import type { Game, PitchType } from '../types'

const PITCH_LABELS: Record<PitchType, string> = {
  fastball: 'Fastball',
  curveball: 'Curveball',
  slider: 'Slider',
  changeup: 'Changeup',
  cutter: 'Cutter',
  splitter: 'Splitter',
}

export function PitcherReportPage() {
  const { pitcherId } = useParams<{ pitcherId: string }>()
  const [games, setGames] = useState<Game[]>([])
  const [pitcherName, setPitcherName] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!pitcherId) return
    Promise.all([getGamesByPitcher(pitcherId), getPitcher(pitcherId)]).then(
      ([g, p]) => {
        setGames(g.filter((game) => game.isComplete).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
        setPitcherName(p?.name ?? 'Unknown')
        setLoading(false)
      }
    )
  }, [pitcherId])

  if (loading) {
    return (
      <div className="page pitcher-report-page">
        <p>Loading...</p>
      </div>
    )
  }

  const totalPitches = games.reduce(
    (sum, g) => sum + g.atBats.reduce((s, ab) => s + ab.pitches.length, 0),
    0
  )
  const totalStrikes = games.reduce(
    (sum, g) =>
      sum +
      g.atBats.reduce(
        (s, ab) =>
          s +
          ab.pitches.filter(
            (p) =>
              p.result === 'whiff' ||
              p.result === 'called_strike' ||
              p.result === 'foul' ||
              p.result === 'in_play'
          ).length,
        0
      ),
    0
  )
  const compositeStrikePct =
    totalPitches > 0 ? ((totalStrikes / totalPitches) * 100).toFixed(1) : '0'

  const compositePitchStats: Record<string, { thrown: number; strikes: number }> = {}
  games.forEach((game) => {
    const stats = getPitchStatsByType(game)
    Object.entries(stats).forEach(([type, s]) => {
      if (!compositePitchStats[type]) compositePitchStats[type] = { thrown: 0, strikes: 0 }
      compositePitchStats[type].thrown += s.thrown
      compositePitchStats[type].strikes += s.strikes
    })
  })

  const pitchRows = Object.entries(compositePitchStats)
    .filter(([, s]) => s.thrown > 0)
    .sort((a, b) => b[1].thrown - a[1].thrown)

  const gameTrends = games.map((g) => {
    const pitches = g.atBats.reduce((s, ab) => s + ab.pitches.length, 0)
    const strikes = g.atBats.reduce(
      (s, ab) =>
        s +
        ab.pitches.filter(
          (p) =>
            p.result === 'whiff' ||
            p.result === 'called_strike' ||
            p.result === 'foul' ||
            p.result === 'in_play'
        ).length,
      0
    )
    return {
      date: g.date,
      opponent: g.opponent,
      pitches,
      strikes,
      strikePct: pitches > 0 ? ((strikes / pitches) * 100).toFixed(1) : '0',
    }
  })

  return (
    <div className="page pitcher-report-page">
      <header>
        <Link to="/reports">← Reports</Link>
        <h1>{pitcherName}</h1>
        <p className="subtitle">Composite report ({games.length} games)</p>
      </header>

      <section className="composite-stats">
        <h2>Overall stats</h2>
        <div className="stats-grid">
          <div className="stat">
            <span className="value">{games.length}</span>
            <span className="label">Games</span>
          </div>
          <div className="stat">
            <span className="value">{totalPitches}</span>
            <span className="label">Total Pitches</span>
          </div>
          <div className="stat">
            <span className="value">{compositeStrikePct}%</span>
            <span className="label">Strike %</span>
          </div>
        </div>
      </section>

      <section className="pitch-breakdown">
        <h2>Pitch usage & strike %</h2>
        <table className="pitch-table">
          <thead>
            <tr>
              <th>Pitch</th>
              <th>Thrown</th>
              <th>Strikes</th>
              <th>Strike %</th>
            </tr>
          </thead>
          <tbody>
            {pitchRows.map(([type, s]) => {
              const pct = s.thrown > 0 ? ((s.strikes / s.thrown) * 100).toFixed(1) : '0'
              return (
                <tr key={type}>
                  <td>{PITCH_LABELS[type as PitchType] ?? type}</td>
                  <td>{s.thrown}</td>
                  <td>{s.strikes}</td>
                  <td>{pct}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section className="trends-section">
        <h2>Strike % by game (trend)</h2>
        <div className="trends-list">
          {gameTrends.map((t) => (
            <div key={t.date + t.opponent} className="trend-row">
              <span className="opponent">{t.opponent}</span>
              <span className="date">{new Date(t.date).toLocaleDateString()}</span>
              <span className="pct">{t.strikePct}%</span>
              <span className="pitches">{t.pitches} pitches</span>
            </div>
          ))}
        </div>
      </section>

      <section className="game-list-section">
        <h2>Individual games</h2>
        <ul className="game-list">
          {games.map((game) => (
          <li key={game.id}>
            <Link to={`/reports/game/${game.id}`}>
                vs {game.opponent}
                <span className="date">{new Date(game.date).toLocaleDateString()}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

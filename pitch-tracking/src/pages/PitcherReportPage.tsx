import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getGamesWherePitcherAppeared, getPitcher } from '../lib/storage'
import {
  getGameFilteredByPitcher,
  getPitchStatsByType,
  getFirstPitchStrikePct,
  getSwingAndMissRateByType,
  getHits,
  getStrikeouts,
  getWalks,
  getStrikeoutPitchTypes,
  getOffspeedStrikes,
  getOffspeedFirstPitchStrikes,
  getGamesContactPointsForPitcher,
  getContactTypeCounts,
  getContactTrajectoryCounts,
} from '../lib/stats'
import type { Game, PitchType } from '../types'
import { PITCH_LABELS, CONTACT_LABELS, TRAJECTORY_LABELS } from '../lib/constants'
import { BaseballField } from '../components/BaseballField'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { ErrorMessage } from '../components/ErrorMessage'
import { pitcherReportToCSV, downloadCSV } from '../lib/export'

export function PitcherReportPage() {
  const { pitcherId } = useParams<{ pitcherId: string }>()
  const [games, setGames] = useState<Game[]>([])
  const [pitcherName, setPitcherName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = () => {
    if (!pitcherId) {
      setLoading(false)
      return
    }
    setError(null)
    setLoading(true)
    Promise.all([getGamesWherePitcherAppeared(pitcherId), getPitcher(pitcherId)])
      .then(([g, p]) => {
        setGames(g.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
        setPitcherName(p?.name ?? 'Unknown')
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load report')
        setLoading(false)
      })
  }

  useEffect(() => {
    loadData()
  }, [pitcherId])

  if (loading) {
    return (
      <div className="page pitcher-report-page">
        <LoadingSkeleton variant="page" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="page pitcher-report-page">
        <ErrorMessage message={error} onRetry={loadData} />
      </div>
    )
  }

  const filteredGames = pitcherId ? games.map((g) => getGameFilteredByPitcher(g, pitcherId)) : []

  const totalPitches = filteredGames.reduce(
    (sum, g) => sum + g.atBats.reduce((s, ab) => s + ab.pitches.length, 0),
    0
  )
  const totalStrikes = filteredGames.reduce(
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

  const compositePitchStats: Record<string, { thrown: number; strikes: number; swings: number; whiffs: number }> = {}
  filteredGames.forEach((game) => {
    const stats = getPitchStatsByType(game)
    const swMiss = getSwingAndMissRateByType(game)
    Object.entries(stats).forEach(([type, s]) => {
      if (!compositePitchStats[type]) {
        compositePitchStats[type] = { thrown: 0, strikes: 0, swings: 0, whiffs: 0 }
      }
      compositePitchStats[type].thrown += s.thrown
      compositePitchStats[type].strikes += s.strikes
      const sm = swMiss[type]
      if (sm) {
        compositePitchStats[type].swings += sm.swings
        compositePitchStats[type].whiffs += sm.whiffs
      }
    })
  })

  const totalHits = filteredGames.reduce((s, g) => s + getHits(g), 0)
  const totalOfficialABs = filteredGames.reduce(
    (s, g) =>
      s +
      g.atBats.filter(
        (ab) =>
          ab.result === 'hit' ||
          ab.result === 'out' ||
          ab.result === 'strikeout' ||
          ab.result === 'error'
      ).length,
    0
  )
  const compositeBAA =
    totalOfficialABs > 0 ? (totalHits / totalOfficialABs).toFixed(3) : '—'
  const totalFirstPitchStrikes = filteredGames.reduce((s, g) => {
    const pct = getFirstPitchStrikePct(g)
    if (pct === '—') return s
    const atBatsWithPitch = g.atBats.filter((ab) => ab.pitches.length > 0)
    const firstStrikes = atBatsWithPitch.filter((ab) => {
      const first = ab.pitches[0]
      return (
        first.result === 'whiff' ||
        first.result === 'called_strike' ||
        first.result === 'foul' ||
        first.result === 'in_play'
      )
    }).length
    return s + firstStrikes
  }, 0)
  const totalAtBatsWithPitch = filteredGames.reduce(
    (s, g) => s + g.atBats.filter((ab) => ab.pitches.length > 0).length,
    0
  )
  const compositeFirstPitchStrikePct =
    totalAtBatsWithPitch > 0
      ? ((totalFirstPitchStrikes / totalAtBatsWithPitch) * 100).toFixed(1)
      : '—'
  const totalBattersFaced = filteredGames.reduce((s, g) => s + g.atBats.length, 0)
  const compositePitchesPerBatter =
    totalBattersFaced > 0
      ? (filteredGames.reduce(
          (s, g) =>
            s + g.atBats.reduce((sum, ab) => sum + ab.pitches.length, 0),
          0
        ) /
        totalBattersFaced).toFixed(1)
      : '—'

  const totalStrikeouts = filteredGames.reduce((s, g) => s + getStrikeouts(g), 0)
  const totalWalks = filteredGames.reduce((s, g) => s + getWalks(g), 0)

  const compositeKPitchTypes: Record<string, number> = {}
  filteredGames.forEach((g) => {
    const kTypes = getStrikeoutPitchTypes(g)
    Object.entries(kTypes).forEach(([type, count]) => {
      compositeKPitchTypes[type] = (compositeKPitchTypes[type] ?? 0) + count
    })
  })

  const totalOffspeedStrikes = filteredGames.reduce((s, g) => s + getOffspeedStrikes(g), 0)
  const totalOffspeedFirstPitchStrikes = filteredGames.reduce(
    (s, g) => s + getOffspeedFirstPitchStrikes(g),
    0
  )

  const sprayPoints = pitcherId ? getGamesContactPointsForPitcher(games, pitcherId) : []

  const compositeContactType: Record<string, number> = { hard: 0, average: 0, weak: 0, bunt: 0 }
  const compositeContactTraj: Record<string, number> = { groundball: 0, line_drive: 0, flyball: 0, pop_up: 0 }
  filteredGames.forEach((g) => {
    const typeCounts = getContactTypeCounts(g)
    const trajCounts = getContactTrajectoryCounts(g)
    ;(['hard', 'average', 'weak', 'bunt'] as const).forEach((t) => {
      compositeContactType[t] = (compositeContactType[t] ?? 0) + (typeCounts[t] ?? 0)
    })
    ;(['groundball', 'line_drive', 'flyball', 'pop_up'] as const).forEach((t) => {
      compositeContactTraj[t] = (compositeContactTraj[t] ?? 0) + (trajCounts[t] ?? 0)
    })
  })
  const contactTypeTotal = Object.values(compositeContactType).reduce((a, b) => a + b, 0)
  const contactTrajTotal = Object.values(compositeContactTraj).reduce((a, b) => a + b, 0)

  const pitchRows = Object.entries(compositePitchStats)
    .filter(([, s]) => s.thrown > 0)
    .sort((a, b) => b[1].thrown - a[1].thrown)

  const handleExportCSV = () => {
    const csv = pitcherReportToCSV(pitcherName, games)
    const filename = `pitch-report-${pitcherName.replace(/\s+/g, '-')}-${games.length}-games.csv`
    downloadCSV(csv, filename)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="page pitcher-report-page">
      <header>
        <Link to="/reports">← Reports</Link>
        <h1>{pitcherName}</h1>
        <p className="subtitle">Composite report</p>
        <div className="report-actions">
          <button type="button" className="btn btn-secondary" onClick={handleExportCSV}>
            Export CSV
          </button>
          <button type="button" className="btn btn-secondary" onClick={handlePrint}>
            Print / Save as PDF
          </button>
        </div>
      </header>

      <section className="composite-stats">
        <h2>Overall stats</h2>
        <div className="stats-grid stats-grid-wide">
          <div className="stat">
            <span className="value">{totalPitches}</span>
            <span className="label">Total Pitches</span>
          </div>
          <div className="stat">
            <span className="value">{compositeStrikePct}%</span>
            <span className="label">Strike %</span>
          </div>
          <div className="stat">
            <span className="value">{totalStrikeouts}</span>
            <span className="label">Strikeouts</span>
          </div>
          <div className="stat">
            <span className="value">{totalWalks}</span>
            <span className="label">Walks</span>
          </div>
          <div className="stat">
            <span className="value">{compositeFirstPitchStrikePct}%</span>
            <span className="label">1st Pitch Strike %</span>
          </div>
          <div className="stat">
            <span className="value">{compositeBAA}</span>
            <span className="label">BAA</span>
          </div>
          <div className="stat">
            <span className="value">{compositePitchesPerBatter}</span>
            <span className="label">Pitches/Batter</span>
          </div>
          <div className="stat">
            <span className="value">{totalOffspeedStrikes}</span>
            <span className="label">Offspeed Strikes</span>
          </div>
          <div className="stat">
            <span className="value">{totalOffspeedFirstPitchStrikes}</span>
            <span className="label">Offspeed 1st Pitch Strikes</span>
          </div>
        </div>
      </section>

      {Object.keys(compositeKPitchTypes).length > 0 && (
        <section className="report-section">
          <h2>Strikeout pitch (last pitch of each K)</h2>
          <div className="k-pitch-breakdown">
            {Object.entries(compositeKPitchTypes)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => (
                <span key={type} className="k-pitch-item">
                  {PITCH_LABELS[type as PitchType] ?? type}: {count}
                </span>
              ))}
          </div>
        </section>
      )}

      <section className="pitch-breakdown">
        <h2>Pitch usage & strike %</h2>
        <table className="pitch-table">
          <thead>
            <tr>
              <th>Pitch</th>
              <th>Thrown</th>
              <th>Strikes</th>
              <th>Strike %</th>
              <th>Sw/Miss %</th>
            </tr>
          </thead>
          <tbody>
            {pitchRows.map(([type, s]) => {
              const pct = s.thrown > 0 ? ((s.strikes / s.thrown) * 100).toFixed(1) : '0'
              const swMissPct =
                s.swings > 0 ? ((s.whiffs / s.swings) * 100).toFixed(1) : '—'
              return (
                <tr key={type}>
                  <td>{PITCH_LABELS[type as PitchType] ?? type}</td>
                  <td>{s.thrown}</td>
                  <td>{s.strikes}</td>
                  <td>{pct}%</td>
                  <td>{swMissPct}{swMissPct !== '—' ? '%' : ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      {(contactTypeTotal > 0 || contactTrajTotal > 0) && (
        <section className="report-section">
          <h2>Contact metrics</h2>
          <div className="contact-metrics">
            {contactTypeTotal > 0 && (
              <div className="contact-metrics-group">
                <h4>Contact quality (%)</h4>
                <div className="contact-type-grid">
                  {(['hard', 'average', 'weak', 'bunt'] as const).map((type) => {
                    const pct = ((compositeContactType[type] ?? 0) / contactTypeTotal * 100).toFixed(1)
                    return (
                      <div key={type} className="contact-stat">
                        <span className="value">{pct}%</span>
                        <span className="label">{CONTACT_LABELS[type]}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {contactTrajTotal > 0 && (
              <div className="contact-metrics-group">
                <h4>Contact trajectory (%)</h4>
                <div className="contact-type-grid">
                  {(['groundball', 'line_drive', 'flyball', 'pop_up'] as const).map((traj) => {
                    const pct = ((compositeContactTraj[traj] ?? 0) / contactTrajTotal * 100).toFixed(1)
                    return (
                      <div key={traj} className="contact-stat">
                        <span className="value">{pct}%</span>
                        <span className="label">{TRAJECTORY_LABELS[traj]}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="report-section">
        <h2>Spray chart</h2>
        <div className="report-spray-chart">
          {sprayPoints.length === 0 ? (
            <p className="no-data">No hit locations recorded</p>
          ) : (
            <>
              <div className="spray-legend">
                <span className="legend-item gb">GB</span>
                <span className="legend-item ld">LD</span>
                <span className="legend-item fb">FB/Pop</span>
              </div>
              <BaseballField contactPoints={sprayPoints} interactive={false} size={220} />
            </>
          )}
        </div>
      </section>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useGame } from '../hooks/useGame'
import { PostGameReport } from '../components/PostGameReport'
import { GamePitcherSummary } from '../components/GamePitcherSummary'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { ErrorMessage } from '../components/ErrorMessage'
import { gameToCSV, downloadCSV } from '../lib/export'
import { getPitchersInGame } from '../lib/stats'
import { getPitcher, deleteGame } from '../lib/storage'

export function GameReportPage() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const { game, loading, error } = useGame(gameId ?? null)
  const [pitcherNames, setPitcherNames] = useState<Record<string, string>>({})
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!game) return
    const pitchers = getPitchersInGame(game)
    const loadNames = async () => {
      const names: Record<string, string> = {}
      for (const { pitcherId } of pitchers) {
        if (pitcherId === game.pitcherId) {
          names[pitcherId] = game.pitcher.name
        } else {
          const p = await getPitcher(pitcherId)
          names[pitcherId] = p?.name ?? 'Unknown'
        }
      }
      setPitcherNames(names)
    }
    loadNames()
  }, [game])

  if (loading) {
    return (
      <div className="page game-report-page">
        <LoadingSkeleton variant="page" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="page game-report-page">
        <ErrorMessage message={error} onRetry={() => window.location.reload()} />
      </div>
    )
  }

  if (!game) {
    return (
      <div className="page game-report-page">
        <p>Game not found.</p>
        <Link to="/reports">Back to Reports</Link>
      </div>
    )
  }

  const handleExportCSV = () => {
    const csv = gameToCSV(game)
    const filename = `pitch-report-${game.pitcher.name.replace(/\s+/g, '-')}-vs-${game.opponent.replace(/\s+/g, '-')}-${game.date}.csv`
    downloadCSV(csv, filename)
  }

  const handlePrint = () => {
    window.print()
  }

  const handleDelete = async () => {
    if (!game || !window.confirm('Delete this game report? This cannot be undone.')) return
    setDeleting(true)
    try {
      await deleteGame(game.id)
      navigate('/reports')
    } catch (err) {
      setDeleting(false)
      alert(err instanceof Error ? err.message : 'Failed to delete game')
    }
  }

  const pitchersInGame = getPitchersInGame(game)

  return (
    <div className="page game-report-page">
      <header>
        <Link to="/reports">← Reports</Link>
      </header>
      <PostGameReport game={game} overall />
      <section className="individual-pitchers-section">
        <h3>Individual pitcher performance</h3>
        <div className="pitcher-summaries">
          {pitchersInGame.map(({ pitcherId, atBatCount }) => (
            <GamePitcherSummary
              key={pitcherId}
              game={game}
              pitcherId={pitcherId}
              pitcherName={pitcherNames[pitcherId] ?? 'Loading…'}
              atBatCount={atBatCount}
            />
          ))}
        </div>
      </section>
      <div className="actions">
        <button type="button" className="btn btn-secondary" onClick={handleExportCSV}>
          Export CSV
        </button>
        <button type="button" className="btn btn-secondary" onClick={handlePrint}>
          Print / Save as PDF
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? 'Deleting…' : 'Delete report'}
        </button>
      </div>
    </div>
  )
}

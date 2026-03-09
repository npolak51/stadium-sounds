import { useParams, Link } from 'react-router-dom'
import { useGame } from '../hooks/useGame'
import { PostGameReport } from '../components/PostGameReport'

export function GameReportPage() {
  const { gameId } = useParams<{ gameId: string }>()
  const { game, loading } = useGame(gameId ?? null)

  if (loading) {
    return (
      <div className="page game-report-page">
        <p>Loading...</p>
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

  return (
    <div className="page game-report-page">
      <header>
        <Link to="/reports">← Reports</Link>
      </header>
      <PostGameReport game={game} />
      <div className="actions">
        <Link to={`/reports/pitcher/${game.pitcherId}`} className="btn">
          View Pitcher Report
        </Link>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getAllGames, getAllPitchers, getGamesByPitcher } from '../lib/storage'
import type { Game, Pitcher } from '../types'

export function ReportsPage() {
  const [pitchers, setPitchers] = useState<(Pitcher & { gameCount: number })[]>([])
  const [recentGames, setRecentGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getAllPitchers(), getAllGames()]).then(async ([p, games]) => {
      const completed = games.filter((g) => g.isComplete)
      const withCounts = await Promise.all(
        p.map(async (pitcher) => {
          const pitcherGames = await getGamesByPitcher(pitcher.id)
          return {
            ...pitcher,
            gameCount: pitcherGames.filter((g) => g.isComplete).length,
          }
        })
      )
      setPitchers(withCounts.filter((x) => x.gameCount > 0).sort((a, b) => b.gameCount - a.gameCount))
      setRecentGames(
        completed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 15)
      )
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="page reports-page">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="page reports-page">
      <header>
        <h1>Reports</h1>
        <p className="subtitle">Post-game reports and historical data</p>
      </header>

      <section className="reports-section">
        <h2>Pitcher reports</h2>
        <p className="section-desc">Composite stats across all appearances</p>
        <ul className="pitcher-list">
          {pitchers.map((pitcher) => (
            <li key={pitcher.id}>
              <Link to={`/reports/pitcher/${pitcher.id}`}>
                <span className="name">{pitcher.name}</span>
                <span className="games">{pitcher.gameCount} games</span>
              </Link>
            </li>
          ))}
        </ul>
        {pitchers.length === 0 && (
          <p className="empty">No reports yet. Complete a game to see reports.</p>
        )}
      </section>

      <section className="reports-section">
        <h2>Recent games</h2>
        <p className="section-desc">View post-game report for any game</p>
        <ul className="game-list">
          {recentGames.map((game) => (
            <li key={game.id}>
              <Link to={`/reports/game/${game.id}`}>
                {game.pitcher.name} vs {game.opponent}
                <span className="date">
                  {new Date(game.date).toLocaleDateString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {recentGames.length === 0 && (
          <p className="empty">No completed games yet.</p>
        )}
      </section>
    </div>
  )
}

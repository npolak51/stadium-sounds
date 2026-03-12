import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getAllGames, getAllPitchers, saveGame, generateId, deleteGame } from '../lib/storage'
import type { Game, Pitcher, LineupSlot } from '../types'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { ErrorMessage } from '../components/ErrorMessage'

const DEFAULT_LINEUP = (): LineupSlot[] =>
  Array.from({ length: 9 }, (_, i) => ({
    order: i + 1,
    originalBatter: {},
    currentBatter: {},
  }))

export function TrackingPage() {
  const navigate = useNavigate()
  const [games, setGames] = useState<Game[]>([])
  const [pitchers, setPitchers] = useState<Pitcher[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newGameStep, setNewGameStep] = useState<'idle' | 'lineup' | 'details'>('idle')
  const [lineup, setLineup] = useState<LineupSlot[]>(DEFAULT_LINEUP())
  const [selectedPitcherId, setSelectedPitcherId] = useState<string>('')
  const [opponent, setOpponent] = useState('')
  const [gameDate, setGameDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [location, setLocation] = useState('')
  const [cameFromQuickStart, setCameFromQuickStart] = useState(false)
  const [deletingGameId, setDeletingGameId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = () => {
    setError(null)
    Promise.all([getAllGames(), getAllPitchers()])
      .then(([g, p]) => {
        setGames(g.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
        setPitchers(p)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load data')
        setLoading(false)
      })
  }

  const handleStartNewGame = () => {
    if (pitchers.length === 0) return
    setLineup(DEFAULT_LINEUP())
    setNewGameStep('lineup')
  }

  const handleLineupNext = () => {
    setSelectedPitcherId(pitchers[0]?.id ?? '')
    setOpponent('')
    setGameDate(new Date().toISOString().slice(0, 10))
    setLocation('')
    setCameFromQuickStart(false)
    setNewGameStep('details')
  }

  const QUICK_LINEUP = (): LineupSlot[] =>
    Array.from({ length: 9 }, (_, i) => ({
      order: i + 1,
      originalBatter: { name: `Batter ${i + 1}` },
      currentBatter: { name: `Batter ${i + 1}` },
    }))

  const handleQuickStart = () => {
    if (pitchers.length === 0) return
    setLineup(QUICK_LINEUP())
    setSelectedPitcherId(pitchers[0]?.id ?? '')
    setOpponent('')
    setGameDate(new Date().toISOString().slice(0, 10))
    setLocation('')
    setCameFromQuickStart(true)
    setNewGameStep('details')
  }

  const updateLineupSlot = (index: number, name: string, jerseyNumber: string) => {
    setLineup((prev) => {
      const next = [...prev]
      next[index] = {
        ...next[index],
        originalBatter: {
          name: name.trim() || undefined,
          jerseyNumber: jerseyNumber.trim() || undefined,
        },
        currentBatter: {
          name: name.trim() || undefined,
          jerseyNumber: jerseyNumber.trim() || undefined,
        },
      }
      return next
    })
  }

  const handleCreateGame = async () => {
    const pitcher = pitchers.find((p) => p.id === selectedPitcherId)
    if (!pitcher) return
    if (!opponent.trim()) return

    const game: Game = {
      id: generateId(),
      date: gameDate,
      opponent: opponent.trim(),
      location: location.trim() || undefined,
      pitcherId: pitcher.id,
      pitcher,
      opposingLineup: lineup,
      isComplete: false,
      atBats: [],
      createdAt: new Date().toISOString(),
    }
    await saveGame(game)
    setNewGameStep('idle')
    setOpponent('')
    navigate(`/tracking/game/${game.id}`)
  }

  const handleDeleteGame = async (e: React.MouseEvent, gameId: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!window.confirm('Delete this game? This cannot be undone.')) return
    setDeletingGameId(gameId)
    try {
      await deleteGame(gameId)
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete game')
    } finally {
      setDeletingGameId(null)
    }
  }

  if (loading) {
    return (
      <div className="page tracking-page">
        <LoadingSkeleton variant="page" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="page tracking-page">
        <ErrorMessage message={error} onRetry={loadData} />
      </div>
    )
  }

  const activeGames = games.filter((g) => !g.isComplete)
  const recentGames = games.filter((g) => g.isComplete).slice(0, 10)

  return (
    <div className="page tracking-page">
      <header>
        <h1>Tracking</h1>
        <p className="subtitle">In-game pitch tracking and live stats</p>
      </header>

      <div className="new-game-actions">
        <button
          type="button"
          className="new-game-btn"
          onClick={handleStartNewGame}
          disabled={pitchers.length === 0}
        >
          + New Game
        </button>
        <button
          type="button"
          className="quick-start-btn"
          onClick={handleQuickStart}
          disabled={pitchers.length === 0}
        >
          Quick start
        </button>
      </div>
      <p className="quick-start-hint">Quick start uses &quot;Batter 1&quot;, &quot;Batter 2&quot;, etc. — you can fill in names during the game.</p>

      {pitchers.length === 0 && (
        <p className="hint-text">
          Add pitchers to your roster first, then start a game.
        </p>
      )}

      {newGameStep === 'lineup' && (
        <div className="new-game-modal lineup-modal">
          <h2>Opposing team lineup</h2>
          <p className="modal-hint">Enter name and/or number for each batter (both optional)</p>
          <div className="lineup-entries">
            {lineup.map((slot, i) => (
              <div key={slot.order} className="lineup-slot">
                <span className="slot-number">{slot.order}</span>
                <input
                  type="text"
                  placeholder="Name"
                  value={slot.originalBatter.name ?? ''}
                  onChange={(e) =>
                    updateLineupSlot(i, e.target.value, slot.originalBatter.jerseyNumber ?? '')
                  }
                />
                <input
                  type="text"
                  placeholder="#"
                  className="jersey-input"
                  value={slot.originalBatter.jerseyNumber ?? ''}
                  onChange={(e) =>
                    updateLineupSlot(i, slot.originalBatter.name ?? '', e.target.value)
                  }
                />
              </div>
            ))}
          </div>
          <div className="modal-actions">
            <button type="button" onClick={() => setNewGameStep('idle')}>
              Cancel
            </button>
            <button type="button" onClick={handleLineupNext}>
              Next
            </button>
          </div>
        </div>
      )}

      {newGameStep === 'details' && (
        <div className="new-game-modal">
          <h2>Game details</h2>
          <div className="form-group">
            <label>Date</label>
            <input
              type="date"
              value={gameDate}
              onChange={(e) => setGameDate(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Pitcher</label>
            <select
              value={selectedPitcherId}
              onChange={(e) => setSelectedPitcherId(e.target.value)}
            >
              {pitchers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.jerseyNumber ? `#${p.jerseyNumber}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Opponent</label>
            <input
              type="text"
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              placeholder="Opponent name"
            />
          </div>
          <div className="form-group">
            <label>Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Home, Away, field name (optional)"
            />
          </div>
          <div className="modal-actions">
            <button
              type="button"
              onClick={() =>
                cameFromQuickStart ? setNewGameStep('idle') : setNewGameStep('lineup')
              }
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleCreateGame}
              disabled={!opponent.trim()}
            >
              Start Game
            </button>
          </div>
        </div>
      )}

      <section className="games-section">
        {activeGames.length > 0 && (
          <>
            <h2>Active games</h2>
            <ul className="game-list">
              {activeGames.map((game) => (
                <li key={game.id} className="game-list-item-with-actions">
                  <Link to={`/tracking/game/${game.id}`} className="game-link">
                    {game.pitcher.name} vs {game.opponent}
                    <span className="date">
                      {new Date(game.date).toLocaleDateString()}
                    </span>
                  </Link>
                  <button
                    type="button"
                    className="delete-game-btn"
                    onClick={(e) => handleDeleteGame(e, game.id)}
                    disabled={deletingGameId === game.id}
                    title="Delete game"
                    aria-label="Delete game"
                  >
                    {deletingGameId === game.id ? '…' : 'Delete'}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <h2>Recent games</h2>
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
      </section>
    </div>
  )
}

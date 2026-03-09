import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getAllGames, getAllPitchers, saveGame, generateId } from '../lib/storage'
import type { Game, Pitcher, LineupSlot } from '../types'

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
  const [newGameStep, setNewGameStep] = useState<'idle' | 'lineup' | 'details'>('idle')
  const [lineup, setLineup] = useState<LineupSlot[]>(DEFAULT_LINEUP())
  const [selectedPitcherId, setSelectedPitcherId] = useState<string>('')
  const [opponent, setOpponent] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = () => {
    Promise.all([getAllGames(), getAllPitchers()]).then(([g, p]) => {
      setGames(g.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
      setPitchers(p)
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
      date: new Date().toISOString().slice(0, 10),
      opponent: opponent.trim(),
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

  if (loading) {
    return (
      <div className="page tracking-page">
        <p>Loading...</p>
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

      <button
        type="button"
        className="new-game-btn"
        onClick={handleStartNewGame}
        disabled={pitchers.length === 0}
      >
        + New Game
      </button>

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
          <div className="modal-actions">
            <button type="button" onClick={() => setNewGameStep('lineup')}>
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
                <li key={game.id}>
                  <Link to={`/tracking/game/${game.id}`}>
                    {game.pitcher.name} vs {game.opponent}
                    <span className="date">
                      {new Date(game.date).toLocaleDateString()}
                    </span>
                  </Link>
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

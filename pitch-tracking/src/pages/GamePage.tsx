import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useGame } from '../hooks/useGame'
import { PitchInput, type PitchData } from '../components/PitchInput'
import { AtBatResultInput } from '../components/AtBatResultInput'
import { BatterLastAtBat } from '../components/BatterLastAtBat'
import { PitchPerformance } from '../components/PitchPerformance'
import { PostGameReport } from '../components/PostGameReport'
import { getBatterLastAtBat, getCurrentCount } from '../lib/stats'
import type { Batter, LineupSlot } from '../types'
import { generateId } from '../lib/storage'

function defaultLineup(game: { opposingLineup?: LineupSlot[] }) {
  if (game.opposingLineup?.length) return game.opposingLineup
  return Array.from({ length: 9 }, (_, i) => ({
    order: i + 1,
    originalBatter: {} as { name?: string; jerseyNumber?: string },
    currentBatter: {} as { name?: string; jerseyNumber?: string },
  }))
}

function formatBatterDisplay(batter: { name?: string; jerseyNumber?: string } | Batter): string {
  const name = 'name' in batter ? batter.name : ''
  const num = 'jerseyNumber' in batter ? batter.jerseyNumber : ''
  if (name && num) return `${name} #${num}`
  if (name) return name
  if (num) return `#${num}`
  return 'Batter'
}

export function GamePage() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const {
    game,
    loading,
    addAtBat,
    addPitch,
    completeAtBat,
    completeGame,
    substituteBatter,
    replaceBatterWithOriginal,
  } = useGame(gameId ?? null)

  const [newBatterName, setNewBatterName] = useState('')
  const [newBatterNumber, setNewBatterNumber] = useState('')
  const [currentAtBatId, setCurrentAtBatId] = useState<string | null>(null)
  const [showReport, setShowReport] = useState(false)
  const [showSub, setShowSub] = useState<'idle' | 'new' | 'choice'>('idle')
  const [subBatterName, setSubBatterName] = useState('')
  const [subBatterNumber, setSubBatterNumber] = useState('')

  useEffect(() => {
    if (game && !currentAtBatId) {
      const order = (game.atBats.length % 9) + 1
      const slots = defaultLineup(game)
      const slot = slots.find((s) => s.order === order)
      if (slot) {
        setNewBatterName(slot.currentBatter.name ?? '')
        setNewBatterNumber(slot.currentBatter.jerseyNumber ?? '')
      }
    }
  }, [game, currentAtBatId])

  if (loading || !game) {
    return (
      <div className="page game-page">
        <p>Loading game...</p>
      </div>
    )
  }

  const lineup = defaultLineup(game)
  const nextSlotOrder = (game.atBats.length % 9) + 1
  const selectedSlot = lineup.find((s) => s.order === nextSlotOrder)

  const currentAtBat = currentAtBatId
    ? game.atBats.find((a) => a.id === currentAtBatId)
    : null
  const count = currentAtBat ? getCurrentCount(currentAtBat) : undefined
  const lastAtBat = currentAtBat
    ? getBatterLastAtBat(game, currentAtBat.batter, currentAtBatId ?? undefined)
    : undefined

  const isOriginalBatter = (): boolean => {
    if (!selectedSlot) return true
    const orig = selectedSlot.originalBatter
    return (
      (newBatterName.trim() || '') === (orig.name ?? '') &&
      (newBatterNumber.trim() || '') === (orig.jerseyNumber ?? '')
    )
  }

  const handleStartAtBat = async () => {
    const batter: Batter = {
      id: generateId(),
      name: newBatterName.trim(),
      jerseyNumber: newBatterNumber.trim() || undefined,
    }
    const atBat = await addAtBat(
      batter,
      1,
      true,
      nextSlotOrder,
      isOriginalBatter()
    )
    if (atBat) {
      setCurrentAtBatId(atBat.id)
      setNewBatterName('')
      setNewBatterNumber('')
    }
  }

  const handlePitch = async (data: PitchData) => {
    if (!currentAtBatId) return
    await addPitch(currentAtBatId, {
      pitchType: data.pitchType,
      result: data.result,
      contactTrajectory: data.contactTrajectory,
      countBefore: count,
    })

    const endsAtBat =
      (data.result === 'whiff' || data.result === 'called_strike') && count?.strikes === 2
        ? 'strikeout'
        : data.result === 'ball' && count?.balls === 3
          ? 'walk'
          : data.result === 'in_play'
            ? data.atBatResult
            : null

    if (endsAtBat) {
      await completeAtBat(currentAtBatId, endsAtBat)
      setCurrentAtBatId(null)
    }
  }

  const handleAtBatResult = async (result: Parameters<typeof completeAtBat>[1]) => {
    if (!currentAtBatId) return
    await completeAtBat(currentAtBatId, result)
    setCurrentAtBatId(null)
  }

  const handleSubClick = () => {
    if (!currentAtBat) return
    if (currentAtBat.isOriginalStarter !== false) {
      setSubBatterName('')
      setSubBatterNumber('')
      setShowSub('new')
    } else {
      setShowSub('choice')
    }
  }

  const handleSubNewBatter = async () => {
    if (!currentAtBatId) return
    await substituteBatter(currentAtBatId, {
      name: subBatterName.trim() || undefined,
      jerseyNumber: subBatterNumber.trim() || undefined,
    })
    setShowSub('idle')
    setSubBatterName('')
    setSubBatterNumber('')
  }

  const handleReenterOriginal = async () => {
    if (!currentAtBatId) return
    await replaceBatterWithOriginal(currentAtBatId)
    setShowSub('idle')
  }

  const handleEndGame = async () => {
    await completeGame()
    setShowReport(true)
  }

  if (showReport && game.isComplete) {
    return (
      <div className="page game-page">
        <PostGameReport game={game} />
        <div className="actions">
          <button type="button" onClick={() => navigate('/tracking')}>
            Back to Tracking
          </button>
          <button type="button" onClick={() => navigate(`/reports/pitcher/${game.pitcherId}`)}>
            View Pitcher Report
          </button>
        </div>
      </div>
    )
  }

  const originalStarterDisplay = currentAtBat
    ? formatBatterDisplay(
        lineup.find((s) => s.order === (currentAtBat.lineupSlotOrder ?? 1))?.originalBatter ?? {}
      )
    : ''

  return (
    <div className="page game-page">
      <header className="game-header">
        <Link to="/tracking" className="back-link">← Tracking</Link>
        <h1>{game.pitcher.name} vs {game.opponent}</h1>
      </header>

      <div className="game-layout">
        <aside className="game-sidebar">
          <BatterLastAtBat
            atBat={lastAtBat}
            label="Batter's last AB"
          />
          <PitchPerformance game={game} />
        </aside>

        <main className="game-main">
          {!currentAtBatId ? (
            <div className="new-at-bat">
              <h2>New batter</h2>
              <p className="batter-up-hint">Batting {nextSlotOrder} up</p>
              <div className="batter-input">
                <input
                  type="text"
                  placeholder="Name (optional)"
                  value={newBatterName}
                  onChange={(e) => setNewBatterName(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="# (optional)"
                  value={newBatterNumber}
                  onChange={(e) => setNewBatterNumber(e.target.value)}
                  className="jersey-input"
                />
                <button type="button" onClick={handleStartAtBat}>
                  Start AB
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="current-batter-row">
                <div className="current-batter">
                  <h2>{formatBatterDisplay(currentAtBat!.batter)}</h2>
                  {count && (
                    <span className="count">
                      {count.balls}-{count.strikes}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="sub-btn"
                  onClick={handleSubClick}
                >
                  Sub
                </button>
              </div>

              {showSub === 'new' && (
                <div className="sub-form">
                  <span className="sub-label">Enter new batter</span>
                  <div className="batter-input">
                    <input
                      type="text"
                      placeholder="Name (optional)"
                      value={subBatterName}
                      onChange={(e) => setSubBatterName(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="# (optional)"
                      value={subBatterNumber}
                      onChange={(e) => setSubBatterNumber(e.target.value)}
                      className="jersey-input"
                    />
                    <button type="button" onClick={handleSubNewBatter}>
                      Sub
                    </button>
                  </div>
                  <button type="button" className="cancel-sub" onClick={() => setShowSub('idle')}>
                    Cancel
                  </button>
                </div>
              )}

              {showSub === 'choice' && (
                <div className="sub-form">
                  <span className="sub-label">Substitute batter</span>
                  <div className="sub-choices">
                    <button type="button" onClick={() => { setShowSub('new'); setSubBatterName(''); setSubBatterNumber(''); }}>
                      Enter new batter
                    </button>
                    <button type="button" onClick={handleReenterOriginal}>
                      Re-enter {originalStarterDisplay || 'original starter'}
                    </button>
                  </div>
                  <button type="button" className="cancel-sub" onClick={() => setShowSub('idle')}>
                    Cancel
                  </button>
                </div>
              )}

              {showSub === 'idle' && (
                <>
                  <PitchInput onPitch={handlePitch} count={count} />
                  <AtBatResultInput onResult={handleAtBatResult} />
                </>
              )}
            </>
          )}
        </main>
      </div>

      <div className="game-footer">
        <button type="button" className="end-game-btn" onClick={handleEndGame}>
          End Game
        </button>
      </div>
    </div>
  )
}

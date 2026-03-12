import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useGame } from '../hooks/useGame'
import { PitchInput, type PitchData } from '../components/PitchInput'
import { BatterLastAtBat } from '../components/BatterLastAtBat'
import { PitchPerformance } from '../components/PitchPerformance'
import { PitchSequence } from '../components/PitchSequence'
import { PostGameReport } from '../components/PostGameReport'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { ErrorMessage } from '../components/ErrorMessage'
import { getBatterAllPreviousAtBats, getCurrentCount, getOutsFromResult, getOutsInInning } from '../lib/stats'
import type { Batter, LineupSlot } from '../types'
import { generateId, getAllPitchers } from '../lib/storage'

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
    error,
    saveError,
    clearSaveError,
    addAtBat,
    addPitch,
    completeAtBat,
    completeGame,
    substituteBatter,
    replaceBatterWithOriginal,
    removeLastPitch,
    changePitcher,
  } = useGame(gameId ?? null)

  const [newBatterName, setNewBatterName] = useState('')
  const [newBatterNumber, setNewBatterNumber] = useState('')
  const [currentAtBatId, setCurrentAtBatId] = useState<string | null>(null)
  const [showReport, setShowReport] = useState(false)
  const [currentInning, setCurrentInning] = useState(1)
  const [isTopInning, setIsTopInning] = useState(true)
  const [showSub, setShowSub] = useState<'idle' | 'new' | 'choice'>('idle')
  const [subBatterName, setSubBatterName] = useState('')
  const [subBatterNumber, setSubBatterNumber] = useState('')
  const [showPitcherChange, setShowPitcherChange] = useState(false)
  const [pitchers, setPitchers] = useState<{ id: string; name: string; jerseyNumber?: string }[]>([])

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

  useEffect(() => {
    if (showPitcherChange) {
      getAllPitchers().then(setPitchers)
    }
  }, [showPitcherChange])

  if (loading) {
    return (
      <div className="page game-page">
        <LoadingSkeleton variant="page" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="page game-page">
        <ErrorMessage message={error} onRetry={() => window.location.reload()} />
      </div>
    )
  }

  if (!game) {
    return (
      <div className="page game-page">
        <p>Game not found.</p>
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
  const batterForPreviousABs = currentAtBat?.batter ?? selectedSlot?.currentBatter
  const previousAtBats = batterForPreviousABs
    ? getBatterAllPreviousAtBats(game, batterForPreviousABs, currentAtBatId ?? undefined)
    : []
  const atBatsToShow = currentAtBat
    ? [...previousAtBats, currentAtBat]
    : previousAtBats

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
      currentInning,
      isTopInning,
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
    const result = await addPitch(currentAtBatId, {
      pitchType: data.pitchType,
      result: data.result,
      contactTrajectory: data.contactTrajectory,
      contactType: data.contactType,
      hitLocation: data.hitLocation,
      countBefore: count,
    })

    const endsAtBat =
      data.result === 'catchers_interference'
        ? 'catchers_interference'
        : (data.result === 'whiff' || data.result === 'called_strike') && count?.strikes === 2
          ? 'strikeout'
          : data.result === 'ball' && count?.balls === 3
            ? 'walk'
            : data.result === 'in_play'
              ? data.atBatResult
              : null

    if (endsAtBat && result?.updatedGame) {
      await completeAtBat(currentAtBatId, endsAtBat, result.updatedGame)
      setCurrentAtBatId(null)
      advanceInningIfThreeOuts(currentAtBat!, endsAtBat)
    }
  }

  const advanceInningIfThreeOuts = (
    atBat: { inning: number; isTopInning: boolean },
    result: Parameters<typeof completeAtBat>[1]
  ) => {
    if (!game || getOutsFromResult(result) === 0) return
    const outsBefore = getOutsInInning(game, atBat.inning, atBat.isTopInning)
    if (outsBefore + 1 < 3) return
    setCurrentInning((n) => n + 1)
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

  const handleUndo = async () => {
    const restoredAtBatId = await removeLastPitch(currentAtBatId ?? undefined)
    if (restoredAtBatId) {
      setCurrentAtBatId(restoredAtBatId)
    }
  }

  const handlePitcherChange = async (pitcherId: string) => {
    await changePitcher(pitcherId)
    setShowPitcherChange(false)
  }

  const mostRecentAtBat = game.atBats[game.atBats.length - 1]
  const canUndo =
    (currentAtBatId && currentAtBat?.pitches && currentAtBat.pitches.length > 0) ||
    (!currentAtBatId && mostRecentAtBat?.pitches && mostRecentAtBat.pitches.length > 0)

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
      {saveError && (
        <div className="save-error-banner">
          {saveError}
          <div className="save-error-actions">
            <button type="button" onClick={clearSaveError}>
              Dismiss
            </button>
            <button type="button" onClick={() => window.location.reload()}>
              Refresh
            </button>
          </div>
        </div>
      )}
      <header className="game-header">
        <Link to="/tracking" className="back-link">← Tracking</Link>
        <h1>{game.pitcher.name} vs {game.opponent}</h1>
        <p className="inning-display">
          Inning {currentInning}, {isTopInning ? 'top' : 'bottom'}
        </p>
        <div className="inning-controls">
          <span className="inning-label">Inning</span>
          <button
            type="button"
            className="inning-btn"
            onClick={() => setCurrentInning((n) => Math.max(1, n - 1))}
            aria-label="Previous inning"
          >
            −
          </button>
          <span className="inning-value">{currentInning}</span>
          <button
            type="button"
            className="inning-btn"
            onClick={() => setCurrentInning((n) => n + 1)}
            aria-label="Next inning"
          >
            +
          </button>
          <button
            type="button"
            className={`inning-half-btn ${isTopInning ? 'active' : ''}`}
            onClick={() => setIsTopInning(true)}
          >
            Top
          </button>
          <button
            type="button"
            className={`inning-half-btn ${!isTopInning ? 'active' : ''}`}
            onClick={() => setIsTopInning(false)}
          >
            Bot
          </button>
          <span className="total-pitches">
            {game.atBats
              .filter((ab) => ab.pitcherId === game.pitcherId)
              .reduce((sum, ab) => sum + ab.pitches.length, 0)} pitches
          </span>
          <button
            type="button"
            className="change-pitcher-btn"
            onClick={() => setShowPitcherChange(true)}
          >
            Change pitcher
          </button>
          <button
            type="button"
            className="end-game-header-btn"
            onClick={handleEndGame}
          >
            End Game
          </button>
        </div>
      </header>

      {showPitcherChange && (
        <div
          className="pitcher-change-overlay"
          onClick={() => setShowPitcherChange(false)}
        >
          <div
            className="pitcher-change-modal"
            onClick={(e) => e.stopPropagation()}
          >
          <h3>Change pitcher</h3>
          <div className="pitcher-change-list">
            {pitchers
              .filter((p) => p.id !== game.pitcherId)
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="pitcher-change-option"
                  onClick={() => handlePitcherChange(p.id)}
                >
                  {p.name} {p.jerseyNumber ? `#${p.jerseyNumber}` : ''}
                </button>
              ))}
          </div>
          {pitchers.filter((p) => p.id !== game.pitcherId).length === 0 && (
            <p className="no-other-pitchers">Add more pitchers in Roster to change.</p>
          )}
          <button
            type="button"
            className="cancel-pitcher-change"
            onClick={() => setShowPitcherChange(false)}
          >
            Cancel
          </button>
          </div>
        </div>
      )}

      <div className="game-layout">
        <aside className="game-sidebar">
          <BatterLastAtBat
            atBats={atBatsToShow}
            game={game}
            currentBatter={batterForPreviousABs}
            currentAtBatId={currentAtBatId ?? undefined}
            label="Batter's previous ABs"
          />
          <PitchPerformance game={game} />
        </aside>

        <main className="game-main">
          {!currentAtBatId ? (
            <div className="new-at-bat">
              {canUndo && (
                <button
                  type="button"
                  className="undo-btn undo-btn-above"
                  onClick={handleUndo}
                  title="Undo last pitch"
                >
                  Undo last pitch
                </button>
              )}
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
              <PitchSequence pitches={currentAtBat!.pitches} />

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
                <div className="pitch-input-row">
                  <PitchInput
                    onPitch={handlePitch}
                    count={count}
                    lastPitchType={
                      currentAtBat?.pitches?.length
                        ? currentAtBat.pitches[currentAtBat.pitches.length - 1].pitchType
                        : mostRecentAtBat?.pitches?.length
                          ? mostRecentAtBat.pitches[mostRecentAtBat.pitches.length - 1].pitchType
                          : undefined
                    }
                  />
                  {canUndo && (
                    <button
                      type="button"
                      className="undo-btn"
                      onClick={handleUndo}
                      title="Undo last pitch"
                    >
                      Undo
                    </button>
                  )}
                </div>
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

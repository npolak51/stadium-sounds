import { useState, useEffect } from 'react'
import type {
  PitchType,
  PitchResult,
  ContactTrajectory,
  ContactType,
  AtBatResult,
  HitLocation,
} from '../types'
import { PITCH_TYPE_OPTIONS, CONTACT_TYPE_OPTIONS } from '../lib/constants'
import { BaseballField } from './BaseballField'

function triggerHaptic() {
  if ('vibrate' in navigator) {
    navigator.vibrate(10)
  }
}

const PITCH_TYPES = PITCH_TYPE_OPTIONS

const PITCH_RESULTS: { value: PitchResult; label: string }[] = [
  { value: 'whiff', label: 'Whiff' },
  { value: 'foul', label: 'Foul' },
  { value: 'in_play', label: 'Ball in play' },
  { value: 'called_strike', label: 'Called' },
  { value: 'ball', label: 'Ball' },
  { value: 'catchers_interference', label: "Catcher's Int." },
]

const TRAJECTORIES: { value: ContactTrajectory; label: string }[] = [
  { value: 'flyball', label: 'Fly' },
  { value: 'line_drive', label: 'LD' },
  { value: 'groundball', label: 'GB' },
  { value: 'pop_up', label: 'Pop' },
]

const IN_PLAY_RESULTS: { value: AtBatResult; label: string }[] = [
  { value: 'hit', label: 'Hit' },
  { value: 'out', label: 'Out' },
  { value: 'error', label: 'Error' },
]

export interface PitchData {
  pitchType: PitchType
  result: PitchResult
  contactType?: ContactType
  contactTrajectory?: ContactTrajectory
  hitLocation?: HitLocation
  atBatResult?: AtBatResult
}

interface Props {
  onPitch: (data: PitchData) => void
  count?: { balls: number; strikes: number }
  lastPitchType?: PitchType
}

export function PitchInput({ onPitch, count, lastPitchType = 'fastball' }: Props) {
  const [selectedType, setSelectedType] = useState<PitchType>(lastPitchType)
  const [pendingResult, setPendingResult] = useState<{
    result: PitchResult
    contactType?: ContactType
    contactTrajectory?: ContactTrajectory
    hitLocation?: HitLocation
    locationSkipped?: boolean
    locationConfirmed?: boolean
  } | null>(null)

  useEffect(() => {
    setSelectedType(lastPitchType)
  }, [lastPitchType])

  const submitPitch = (data: PitchData) => {
    triggerHaptic()
    onPitch(data)
  }

  const handleResult = (result: PitchResult) => {
    if (result === 'foul') {
      setPendingResult({ result })
    } else if (result === 'in_play') {
      setPendingResult({ result })
    } else {
      submitPitch({ pitchType: selectedType, result })
    }
  }

  const handleContactType = (contactType: ContactType) => {
    if (!pendingResult) return
    setPendingResult((p) => (p ? { ...p, contactType } : null))
  }

  const handleTrajectory = (contactTrajectory: ContactTrajectory) => {
    if (!pendingResult) return
    setPendingResult((p) => (p ? { ...p, contactTrajectory } : null))
  }

  const handleHitLocation = (hitLocation: HitLocation) => {
    if (!pendingResult) return
    setPendingResult((p) => (p ? { ...p, hitLocation } : null))
  }

  const handleConfirmLocation = () => {
    if (!pendingResult || !pendingResult.hitLocation) return
    if (pendingResult.result === 'foul') {
      submitPitch({
        pitchType: selectedType,
        result: 'foul',
        contactType: pendingResult.contactType,
        contactTrajectory: pendingResult.contactTrajectory,
        hitLocation: pendingResult.hitLocation,
      })
      setPendingResult(null)
    } else if (pendingResult.result === 'in_play') {
      setPendingResult((p) => (p ? { ...p, locationConfirmed: true } : null))
    }
  }

  const handleSkipLocation = () => {
    if (!pendingResult) return
    if (pendingResult.result === 'foul') {
      submitPitch({
        pitchType: selectedType,
        result: 'foul',
        contactType: pendingResult.contactType,
        contactTrajectory: pendingResult.contactTrajectory,
      })
      setPendingResult(null)
    } else if (pendingResult.result === 'in_play') {
      setPendingResult((p) => (p ? { ...p, hitLocation: undefined, locationSkipped: true } : null))
    }
  }

  const handleInPlayResult = (atBatResult: AtBatResult) => {
    if (!pendingResult || pendingResult.result !== 'in_play') return
    submitPitch({
      pitchType: selectedType,
      result: 'in_play',
      contactType: pendingResult.contactType,
      contactTrajectory: pendingResult.contactTrajectory,
      hitLocation: pendingResult.hitLocation,
      atBatResult,
    })
    setPendingResult(null)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (pendingResult) return

      const num = parseInt(e.key, 10)
      if (num >= 1 && num <= 6) {
        e.preventDefault()
        setSelectedType(PITCH_TYPES[num - 1].value)
        return
      }

      const key = e.key.toLowerCase()
      const resultMap: Record<string, PitchResult> = {
        w: 'whiff',
        f: 'foul',
        i: 'in_play',
        c: 'called_strike',
        b: 'ball',
      }
      if (resultMap[key]) {
        e.preventDefault()
        handleResult(resultMap[key])
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedType, pendingResult, handleResult])

  const cancelPending = () => setPendingResult(null)

  return (
    <div className="pitch-input">
      {count && (
        <div className="count-display">
          <span className="balls">{count.balls}</span>
          <span className="dash">-</span>
          <span className="strikes">{count.strikes}</span>
        </div>
      )}

      <div className="pitch-type-buttons">
        {PITCH_TYPES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={`pitch-type-btn ${selectedType === value ? 'selected' : ''}`}
            onClick={() => setSelectedType(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {!pendingResult ? (
        <div className="pitch-result-buttons">
          {PITCH_RESULTS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={`result-btn ${value}`}
              onClick={() => handleResult(value)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : !pendingResult.contactType ? (
        <div className="pitch-detail-step">
          <span className="detail-label">Contact type</span>
          <div className="detail-buttons">
            {CONTACT_TYPE_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className="detail-btn"
                onClick={() => handleContactType(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <button type="button" className="cancel-btn" onClick={cancelPending}>
            Cancel
          </button>
        </div>
      ) : !pendingResult.contactTrajectory ? (
        <div className="pitch-detail-step">
          <span className="detail-label">Contact trajectory</span>
          <div className="detail-buttons">
            {TRAJECTORIES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className="detail-btn"
                onClick={() => handleTrajectory(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <button type="button" className="cancel-btn" onClick={cancelPending}>
            Cancel
          </button>
        </div>
      ) : !pendingResult.hitLocation && !pendingResult.locationSkipped ? (
        <div className="pitch-detail-step">
          <span className="detail-label">Tap where the ball went</span>
          <div className="field-tap-wrapper">
            <BaseballField
              selected={null}
              onSelect={handleHitLocation}
              size={280}
              interactive
            />
          </div>
          <div className="detail-actions">
            <button type="button" className="skip-btn" onClick={handleSkipLocation}>
              Skip
            </button>
            <button type="button" className="cancel-btn" onClick={cancelPending}>
              Cancel
            </button>
          </div>
        </div>
      ) : pendingResult.hitLocation && !pendingResult.locationConfirmed ? (
        <div className="pitch-detail-step">
          <span className="detail-label">Confirm placement</span>
          <div className="field-tap-wrapper">
            <BaseballField
              selected={pendingResult.hitLocation}
              onSelect={handleHitLocation}
              size={280}
              interactive
              draggable
            />
          </div>
          <p className="confirm-hint">Tap elsewhere to change, or confirm to continue</p>
          <div className="detail-actions">
            <button type="button" className="confirm-btn" onClick={handleConfirmLocation}>
              Confirm
            </button>
            <button type="button" className="skip-btn" onClick={handleSkipLocation}>
              Skip
            </button>
            <button type="button" className="cancel-btn" onClick={cancelPending}>
              Cancel
            </button>
          </div>
        </div>
      ) : pendingResult.result === 'in_play' && (pendingResult.locationSkipped || pendingResult.locationConfirmed) ? (
        <div className="pitch-detail-step">
          <span className="detail-label">Result of ball in play</span>
          <div className="detail-buttons">
            {IN_PLAY_RESULTS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className="detail-btn"
                onClick={() => handleInPlayResult(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <button type="button" className="cancel-btn" onClick={cancelPending}>
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  )
}

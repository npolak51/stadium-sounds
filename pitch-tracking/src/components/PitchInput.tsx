import { useState } from 'react'
import type {
  PitchType,
  PitchResult,
  ContactTrajectory,
  AtBatResult,
} from '../types'

const PITCH_TYPES: { value: PitchType; label: string }[] = [
  { value: 'fastball', label: 'FB' },
  { value: 'curveball', label: 'CB' },
  { value: 'slider', label: 'SL' },
  { value: 'changeup', label: 'CH' },
  { value: 'cutter', label: 'CU' },
  { value: 'splitter', label: 'SPL' },
]

const PITCH_RESULTS: { value: PitchResult; label: string }[] = [
  { value: 'whiff', label: 'Whiff' },
  { value: 'foul', label: 'Foul' },
  { value: 'in_play', label: 'Ball in play' },
  { value: 'called_strike', label: 'Called' },
  { value: 'ball', label: 'Ball' },
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
  contactTrajectory?: ContactTrajectory
  atBatResult?: AtBatResult
}

interface Props {
  onPitch: (data: PitchData) => void
  count?: { balls: number; strikes: number }
}

export function PitchInput({ onPitch, count }: Props) {
  const [selectedType, setSelectedType] = useState<PitchType>('fastball')
  const [pendingResult, setPendingResult] = useState<{
    result: PitchResult
    contactTrajectory?: ContactTrajectory
  } | null>(null)

  const handleResult = (result: PitchResult) => {
    if (result === 'foul') {
      setPendingResult({ result })
    } else if (result === 'in_play') {
      setPendingResult({ result })
    } else {
      onPitch({ pitchType: selectedType, result })
    }
  }

  const handleTrajectory = (contactTrajectory: ContactTrajectory) => {
    if (!pendingResult) return
    if (pendingResult.result === 'foul') {
      onPitch({
        pitchType: selectedType,
        result: 'foul',
        contactTrajectory,
      })
      setPendingResult(null)
    } else {
      setPendingResult((p) => (p ? { ...p, contactTrajectory } : null))
    }
  }

  const handleInPlayResult = (atBatResult: AtBatResult) => {
    if (!pendingResult || pendingResult.result !== 'in_play') return
    onPitch({
      pitchType: selectedType,
      result: 'in_play',
      atBatResult,
    })
    setPendingResult(null)
  }

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
      ) : pendingResult.result === 'foul' ? (
        <div className="pitch-detail-step">
          <span className="detail-label">Foul trajectory</span>
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
      ) : (
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
      )}
    </div>
  )
}

import type { AtBat, Game } from '../types'
import { formatAtBatResult, formatPitchSequence, getBatterContactPoints, getAtBatContactPoints } from '../lib/stats'
import { CONTACT_LABELS } from '../lib/constants'
import type { ContactTrajectory, ContactType } from '../types'
import { BaseballField } from './BaseballField'

const TRAJECTORY_ABBREV: Record<ContactTrajectory, string> = {
  groundball: 'GB',
  line_drive: 'LD',
  flyball: 'Fly',
  pop_up: 'Pop',
}

function formatContact(pitch: { contactType?: ContactType; contactTrajectory?: ContactTrajectory }): string | null {
  if (!pitch.contactType || !pitch.contactTrajectory) return null
  const type = CONTACT_LABELS[pitch.contactType]
  const traj = TRAJECTORY_ABBREV[pitch.contactTrajectory]
  return `${type} ${traj}`
}

function ordinal(n: number): string {
  const v = n % 100
  if (v >= 11 && v <= 13) return `${n}th`
  switch (v % 10) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}

interface Props {
  atBats: AtBat[]
  game?: Game
  currentBatter?: { name?: string; jerseyNumber?: string }
  currentAtBatId?: string
  label?: string
}

function isInProgress(atBat: AtBat, currentAtBatId?: string): boolean {
  return atBat.id === currentAtBatId && atBat.result == null
}

export function BatterLastAtBat({
  atBats,
  game,
  currentBatter,
  currentAtBatId,
  label = "Batter's previous ABs",
}: Props) {
  const contactPoints = game && currentBatter
    ? getBatterContactPoints(game, currentBatter, currentAtBatId)
    : []

  if (atBats.length === 0 && contactPoints.length === 0) {
    return (
      <div className="batter-last-ab empty">
        <span className="label">{label}</span>
        <span className="value">No previous AB</span>
      </div>
    )
  }

  return (
    <div className="batter-last-ab batter-last-ab-enlarged">
      <span className="label">{label}</span>
      <div className="previous-ab-list">
        {atBats.map((atBat, index) => {
          const pitchSequence = formatPitchSequence(atBat.pitches)
          const contacts = atBat.pitches
            .map(formatContact)
            .filter((c): c is string => c !== null)
          const inProgress = isInProgress(atBat, currentAtBatId)
          const contactAndResult = inProgress
            ? [...contacts, '(in progress)'].filter(Boolean).join(', ') || '(in progress)'
            : [...contacts, formatAtBatResult(atBat.result)].join(', ')
          const atBatContactPoints = getAtBatContactPoints(atBat)

          return (
            <div key={atBat.id} className={`previous-ab-item ${inProgress ? 'in-progress' : ''}`}>
              <span className="ab-instance">{ordinal(index + 1)} AB</span>
              <span className="ab-pitches">{pitchSequence || '—'}</span>
              <span className="ab-contact-result">{contactAndResult}</span>
              {atBatContactPoints.length > 0 && (
                <div className="ab-spray-chart">
                  <BaseballField
                    contactPoints={atBatContactPoints}
                    interactive={false}
                    size={100}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
      {contactPoints.length > 0 && (
        <div className="spray-chart-section">
          <span className="spray-label">All contacts</span>
          <div className="spray-legend">
            <span className="legend-item gb">GB</span>
            <span className="legend-item ld">LD</span>
            <span className="legend-item fb">FB/Pop</span>
          </div>
          <BaseballField
            contactPoints={contactPoints}
            interactive={false}
            size={120}
          />
        </div>
      )}
    </div>
  )
}

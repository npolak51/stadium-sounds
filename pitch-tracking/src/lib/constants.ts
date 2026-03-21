import type { PitchType, ContactType, ContactTrajectory } from '../types'

export const PITCH_TYPES: PitchType[] = [
  'fastball',
  'curveball',
  'slider',
  'changeup',
  'cutter',
  'splitter',
]

export const PITCH_ABBREV: Record<PitchType, string> = {
  fastball: 'FB',
  curveball: 'CB',
  slider: 'SL',
  changeup: 'CH',
  cutter: 'CT',
  splitter: 'SPL',
}

export const PITCH_LABELS: Record<PitchType, string> = {
  fastball: 'Fastball',
  curveball: 'Curveball',
  slider: 'Slider',
  changeup: 'Changeup',
  cutter: 'Cutter',
  splitter: 'Splitter',
}

export const PITCH_TYPE_OPTIONS: { value: PitchType; label: string }[] = PITCH_TYPES.map(
  (value) => ({ value, label: PITCH_ABBREV[value] })
)

export const CONTACT_TYPE_OPTIONS: { value: ContactType; label: string }[] = [
  { value: 'hard', label: 'Hard' },
  { value: 'average', label: 'Avg' },
  { value: 'weak', label: 'Weak' },
  { value: 'bunt', label: 'Bunt' },
]

export const CONTACT_LABELS: Record<ContactType, string> = {
  hard: 'Hard',
  average: 'Average',
  weak: 'Weak',
  bunt: 'Bunt',
}

export const TRAJECTORY_LABELS: Record<ContactTrajectory, string> = {
  groundball: 'Groundball',
  line_drive: 'Line Drive',
  flyball: 'Fly Ball',
  pop_up: 'Pop Up',
}

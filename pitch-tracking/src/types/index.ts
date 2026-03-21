// Core data types for pitch tracking

export type PitchType = 'fastball' | 'curveball' | 'slider' | 'changeup' | 'cutter' | 'splitter'

export type PitchResult = 'whiff' | 'foul' | 'in_play' | 'called_strike' | 'ball' | 'catchers_interference'

export type ContactTrajectory = 'flyball' | 'line_drive' | 'groundball' | 'pop_up'

export type ContactType = 'weak' | 'average' | 'hard' | 'bunt'

/** Normalized hit location: x,y 0-1, fair=true if in fair territory */
export interface HitLocation {
  x: number
  y: number
  fair: boolean
}

export type Timing = 'early' | 'on_time' | 'late'

export type AtBatResult = 'hit' | 'out' | 'strikeout' | 'walk' | 'error' | 'catchers_interference'

export interface Pitcher {
  id: string
  name: string
  jerseyNumber?: string
}

export interface LineupBatter {
  name?: string
  jerseyNumber?: string
}

export interface LineupSlot {
  order: number
  originalBatter: LineupBatter
  currentBatter: LineupBatter
}

export interface Batter {
  id: string
  name: string
  jerseyNumber?: string
  team?: string
}

export interface Pitch {
  id: string
  gameId: string
  atBatId: string
  pitchType: PitchType
  result: PitchResult
  countBefore?: { balls: number; strikes: number }
  sequenceIndex: number
  timestamp: string
  contactTrajectory?: ContactTrajectory
  contactType?: ContactType
  hitLocation?: HitLocation
  timing?: Timing
}

export interface AtBat {
  id: string
  gameId: string
  batterId: string
  batter: Batter
  pitcherId: string
  inning: number
  isTopInning: boolean
  lineupSlotOrder?: number
  isOriginalStarter?: boolean
  result?: AtBatResult
  pitches: Pitch[]
  timestamp: string
}

export interface Game {
  id: string
  date: string
  opponent: string
  location?: string
  pitcherId: string
  pitcher: Pitcher
  opposingLineup?: LineupSlot[]
  isComplete: boolean
  atBats: AtBat[]
  createdAt: string
}

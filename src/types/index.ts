// Data models matching the original StadiumSounds app structure

export type TeamType = 'Varsity' | 'JV Blue' | 'JV Gold'

export interface Player {
  id: string
  name: string
  number: string
  team: TeamType
}

export type SoundEffectCategory = 'Pre/Postgame' | 'Offense' | 'Defense'

export type PlaylistRepeatMode = 'None' | 'All' | 'One'

export type PurposeType = 'Player Music' | 'Pitcher Entrance' | 'Sound Effect' | 'In-Game Playlist'

export interface AudioAssignment {
  id: string
  fileName: string
  filePath: string
  purpose: PurposeType
  startTime: number
  endTime: number
  duration: number
  player?: string // Player ID for Player Music
  playerOrder?: number // Display order in Player Music tab (per team)
  fadeIn: boolean
  fadeOut: boolean
  soundEffectCategory?: SoundEffectCategory
  soundEffectName?: string  // Custom display name for sound effects
  /** When true, each play resumes from the last stop position within start/end; after reaching end, next play restarts at start. */
  soundEffectSegmentResume?: boolean
  playlistOrder?: number
}

export interface SavedPlaylist {
  id: string
  name: string
  assignments: AudioAssignment[]
  createdAt: string
}

export interface AppConfiguration {
  players: Player[]
  assignments: AudioAssignment[]
  savedPlaylists: SavedPlaylist[]
  exportedAt: string
  version: string
}

// Data models matching the original StadiumSounds app structure

export interface Player {
  id: string
  name: string
  number: string
}

export type SoundEffectCategory = 'Pre/Postgame' | 'Offense' | 'Defense'

export type PlaylistRepeatMode = 'None' | 'All' | 'One'

export type PurposeType = 'Player Music' | 'Sound Effect' | 'In-Game Playlist'

export interface AudioAssignment {
  id: string
  fileName: string
  filePath: string
  purpose: PurposeType
  startTime: number
  endTime: number
  duration: number
  player?: string // Player ID for Player Music
  fadeIn: boolean
  fadeOut: boolean
  soundEffectCategory?: SoundEffectCategory
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

# Stadium Sounds PWA

A Progressive Web App for stadium audio control—player walk-up music, sound effects, and in-game playlists. Built as a modern PWA replacement for the original StadiumSounds iOS app.

## Features

- **Game Tab**: Live playback during games
  - Player lineup with walk-up music
  - Sound effects (Pre/Postgame, Offense, Defense)
  - In-game playlist with load/save
  - Playback controls with progress, play/pause, previous/next, emergency stop

- **Playlists Tab**: Manage saved playlists
  - Save current in-game playlist
  - Load saved playlists
  - Delete playlists

- **Manage Tab**: Configure players and audio
  - **Players**: Add/edit/delete players (name, jersey number)
  - **Audio**: Import audio files, create assignments (Player Music, Sound Effect, In-Game Playlist) with start/end times and fade options
  - **Files**: Storage usage, export/import configuration

## Tech Stack

- React 19 + TypeScript
- Vite 7
- IndexedDB (via idb) for offline persistence
- Web Audio API for playback
- PWA with service worker for offline support

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview  # Preview production build
```

## Install as PWA

1. Open the app in Chrome, Edge, or Safari
2. Use "Add to Home Screen" or the install prompt
3. The app runs standalone and works offline

## Data & Backup

- All data (players, assignments, playlists) is stored in IndexedDB
- Audio files are stored in a separate IndexedDB store
- Use **Manage → Files → Export Config** to backup your configuration
- **Import Config** restores players, assignments, and playlists (audio files must be re-imported if switching devices)

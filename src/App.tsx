import { useState, useEffect } from 'react'
import { AppDataProvider, useAppData } from './context/AppDataContext'
import { PwaUpdateProvider } from './contexts/PwaUpdateContext'
import { UpdateBanner } from './components/UpdateBanner'
import GameView from './views/GameView'
import PlaylistsView from './views/PlaylistsView'
import ManageView from './views/ManageView'
import { preloadBlobs, warmupAudioContext } from './lib/audioService'
import './App.css'

type Tab = 'game' | 'playlists' | 'manage'

function PreloadAudio() {
  const { assignments } = useAppData()
  useEffect(() => {
    const paths = assignments.map(a => a.filePath).filter(Boolean)
    if (paths.length) preloadBlobs(paths)
  }, [assignments])
  return null
}

function App() {
  const [tab, setTab] = useState<Tab>('game')

  /** Prime AudioContext on first gesture (reduces latency on first playback after cold open). */
  useEffect(() => {
    let done = false
    const onFirstPointer = () => {
      if (done) return
      done = true
      window.removeEventListener('pointerdown', onFirstPointer, true)
      void warmupAudioContext()
    }
    window.addEventListener('pointerdown', onFirstPointer, { capture: true })
    return () => window.removeEventListener('pointerdown', onFirstPointer, true)
  }, [])

  return (
    <PwaUpdateProvider>
      <AppDataProvider>
        <PreloadAudio />
        <div className="app">
          <UpdateBanner />
          <header className="app-header">
          <h1 className="app-title">Stadium Sounds</h1>
          <nav className="app-nav">
            <button
              className={`nav-btn ${tab === 'game' ? 'active' : ''}`}
              onClick={() => setTab('game')}
            >
              <span className="nav-icon">▶</span>
              Game
            </button>
            <button
              className={`nav-btn ${tab === 'playlists' ? 'active' : ''}`}
              onClick={() => setTab('playlists')}
            >
              <span className="nav-icon">📋</span>
              Playlists
            </button>
            <button
              className={`nav-btn ${tab === 'manage' ? 'active' : ''}`}
              onClick={() => setTab('manage')}
            >
              <span className="nav-icon">⚙</span>
              Manage
            </button>
          </nav>
        </header>
        <main className="app-main">
          {tab === 'game' && <GameView />}
          {tab === 'playlists' && <PlaylistsView />}
          {tab === 'manage' && <ManageView />}
        </main>
      </div>
    </AppDataProvider>
    </PwaUpdateProvider>
  )
}

export default App

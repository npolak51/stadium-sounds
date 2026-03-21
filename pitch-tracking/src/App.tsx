import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { TabBar } from './components/TabBar'
import { ErrorBoundary } from './components/ErrorBoundary'
import { OfflineIndicator } from './components/OfflineIndicator'
import { TrackingPage } from './pages/TrackingPage'
import { GamePage } from './pages/GamePage'
import { ReportsPage } from './pages/ReportsPage'
import { GameReportPage } from './pages/GameReportPage'
import { PitcherReportPage } from './pages/PitcherReportPage'
import { RosterPage } from './pages/RosterPage'
import { DataPage } from './pages/DataPage'
import './App.css'

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <div className="app">
          <OfflineIndicator />
          <main className="app-content">
            <Routes>
            <Route path="/" element={<Navigate to="/tracking" replace />} />
            <Route path="/tracking" element={<TrackingPage />} />
            <Route path="/tracking/game/:gameId" element={<GamePage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/reports/game/:gameId" element={<GameReportPage />} />
            <Route path="/reports/pitcher/:pitcherId" element={<PitcherReportPage />} />
            <Route path="/roster" element={<RosterPage />} />
            <Route path="/data" element={<DataPage />} />
            </Routes>
          </main>
          <TabBar />
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App

import { useState, useRef } from 'react'
import {
  exportBackup,
  downloadBackup,
  importBackup,
  parseBackupFile,
} from '../lib/backup'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

export function DataPage() {
  const [restoreStatus, setRestoreStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [restoreMessage, setRestoreMessage] = useState('')
  const [syncUrl, setSyncUrl] = useState(() => localStorage.getItem('pitch-tracker-sync-url') ?? '')
  const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [syncMessage, setSyncMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isOnline = useOnlineStatus()

  const handleBackup = async () => {
    try {
      const data = await exportBackup()
      downloadBackup(data)
    } catch (err) {
      setRestoreStatus('error')
      setRestoreMessage(err instanceof Error ? err.message : 'Failed to create backup')
    }
  }

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setRestoreStatus('loading')
    setRestoreMessage('')
    try {
      const data = await parseBackupFile(file)
      const result = await importBackup(data)
      if (result.success) {
        setRestoreStatus('success')
        setRestoreMessage('Backup restored successfully. Refreshing...')
        setTimeout(() => window.location.reload(), 1500)
      } else {
        setRestoreStatus('error')
        setRestoreMessage(result.error ?? 'Restore failed')
      }
    } catch (err) {
      setRestoreStatus('error')
      setRestoreMessage(err instanceof Error ? err.message : 'Failed to restore backup')
    }
    e.target.value = ''
  }

  const handleSyncToCloud = async () => {
    if (!syncUrl.trim()) {
      setSyncStatus('error')
      setSyncMessage('Enter a sync URL first')
      return
    }
    if (!isOnline) {
      setSyncStatus('error')
      setSyncMessage('You are offline. Connect to sync.')
      return
    }

    setSyncStatus('loading')
    setSyncMessage('')
    try {
      const data = await exportBackup()
      const response = await fetch(syncUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) throw new Error(`Sync failed: ${response.status}`)
      setSyncStatus('success')
      setSyncMessage('Data synced to cloud')
      localStorage.setItem('pitch-tracker-sync-url', syncUrl.trim())
    } catch (err) {
      setSyncStatus('error')
      setSyncMessage(err instanceof Error ? err.message : 'Sync failed')
    }
  }

  const handleSyncFromCloud = async () => {
    if (!syncUrl.trim()) {
      setSyncStatus('error')
      setSyncMessage('Enter a sync URL first')
      return
    }
    if (!isOnline) {
      setSyncStatus('error')
      setSyncMessage('You are offline. Connect to sync.')
      return
    }

    setSyncStatus('loading')
    setSyncMessage('')
    try {
      const response = await fetch(syncUrl)
      if (!response.ok) throw new Error(`Fetch failed: ${response.status}`)
      const data = await response.json()
      const result = await importBackup(data)
      if (result.success) {
        setSyncStatus('success')
        setSyncMessage('Data restored from cloud. Refreshing...')
        localStorage.setItem('pitch-tracker-sync-url', syncUrl.trim())
        setTimeout(() => window.location.reload(), 1500)
      } else {
        setSyncStatus('error')
        setSyncMessage(result.error ?? 'Restore failed')
      }
    } catch (err) {
      setSyncStatus('error')
      setSyncMessage(err instanceof Error ? err.message : 'Sync failed')
    }
  }

  return (
    <div className="page data-page">
      <header>
        <h1>Data</h1>
        <p className="subtitle">Backup, restore, and sync your data</p>
        {!isOnline && (
          <p className="offline-banner">You are offline. Backup/restore from file still works.</p>
        )}
      </header>

      <section className="data-section">
        <h2>Backup & Restore</h2>
        <p className="section-desc">
          Export your data to a file for safekeeping or to move to another device.
        </p>
        <div className="data-actions">
          <button type="button" className="btn btn-primary" onClick={handleBackup}>
            Download backup
          </button>
          <div className="restore-group">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleRestore}
              className="file-input-hidden"
              aria-label="Restore from file"
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={restoreStatus === 'loading'}
            >
              Restore from file
            </button>
          </div>
        </div>
        {restoreStatus !== 'idle' && (
          <p className={`status-message ${restoreStatus}`}>{restoreMessage}</p>
        )}
      </section>

      <section className="data-section">
        <h2>Cloud sync (optional)</h2>
        <p className="section-desc">
          Sync to your own backend. Provide a URL that accepts POST (to save) and GET (to load) JSON.
        </p>
        <div className="sync-input-group">
          <input
            type="url"
            value={syncUrl}
            onChange={(e) => setSyncUrl(e.target.value)}
            placeholder="https://your-backend.com/sync"
            className="sync-url-input"
          />
          <div className="sync-buttons">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleSyncToCloud}
              disabled={!isOnline || syncStatus === 'loading'}
            >
              Push to cloud
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleSyncFromCloud}
              disabled={!isOnline || syncStatus === 'loading'}
            >
              Pull from cloud
            </button>
          </div>
        </div>
        {syncStatus !== 'idle' && (
          <p className={`status-message ${syncStatus}`}>{syncMessage}</p>
        )}
      </section>
    </div>
  )
}

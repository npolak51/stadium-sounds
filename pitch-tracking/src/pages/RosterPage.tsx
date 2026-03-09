import { useState, useEffect } from 'react'
import { getAllPitchers, savePitcher, deletePitcher, generateId } from '../lib/storage'
import type { Pitcher } from '../types'

export function RosterPage() {
  const [pitchers, setPitchers] = useState<Pitcher[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newJersey, setNewJersey] = useState('')

  useEffect(() => {
    loadPitchers()
  }, [])

  const loadPitchers = () => {
    getAllPitchers().then((p) => {
      setPitchers(p.sort((a, b) => a.name.localeCompare(b.name)))
      setLoading(false)
    })
  }

  const handleAdd = async () => {
    if (!newName.trim()) return
    const pitcher: Pitcher = {
      id: generateId(),
      name: newName.trim(),
      jerseyNumber: newJersey.trim() || undefined,
    }
    await savePitcher(pitcher)
    setPitchers((prev) => [...prev, pitcher].sort((a, b) => a.name.localeCompare(b.name)))
    setNewName('')
    setNewJersey('')
    setShowAdd(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this pitcher from the roster?')) return
    await deletePitcher(id)
    setPitchers((prev) => prev.filter((p) => p.id !== id))
  }

  if (loading) {
    return (
      <div className="page roster-page">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="page roster-page">
      <header>
        <h1>Roster</h1>
        <p className="subtitle">Manage your pitchers</p>
      </header>

      <button
        type="button"
        className="add-pitcher-btn"
        onClick={() => setShowAdd(true)}
      >
        + Add Pitcher
      </button>

      {showAdd && (
        <div className="add-pitcher-form">
          <h2>Add Pitcher</h2>
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Pitcher name"
            />
          </div>
          <div className="form-group">
            <label>Jersey #</label>
            <input
              type="text"
              value={newJersey}
              onChange={(e) => setNewJersey(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="form-actions">
            <button type="button" onClick={() => setShowAdd(false)}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!newName.trim()}
            >
              Add
            </button>
          </div>
        </div>
      )}

      <ul className="roster-list">
        {pitchers.map((pitcher) => (
          <li key={pitcher.id} className="roster-item">
            <span className="pitcher-info">
              <strong>{pitcher.name}</strong>
              {pitcher.jerseyNumber && (
                <span className="jersey">#{pitcher.jerseyNumber}</span>
              )}
            </span>
            <button
              type="button"
              className="remove-btn"
              onClick={() => handleDelete(pitcher.id)}
              aria-label="Remove pitcher"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      {pitchers.length === 0 && !showAdd && (
        <p className="empty">No pitchers on roster. Add one to get started.</p>
      )}
    </div>
  )
}

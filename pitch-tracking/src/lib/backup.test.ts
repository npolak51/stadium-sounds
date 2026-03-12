import { describe, it, expect, beforeEach } from 'vitest'
import { importBackup, type BackupData } from './backup'
import { clearAllForTesting } from './db'

beforeEach(async () => {
  await clearAllForTesting()
})

describe('importBackup', () => {
  it('rejects invalid backup - not an object', async () => {
    const result = await importBackup(null)
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid')
  })

  it('rejects invalid backup - missing arrays', async () => {
    const result = await importBackup({ version: 1 })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid')
  })

  it('rejects backup with invalid game structure', async () => {
    const result = await importBackup({
      games: [{ id: 'g1', invalid: true }],
      pitchers: [],
      batters: [],
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid backup structure and imports', async () => {
    const validBackup: BackupData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      games: [
        {
          id: 'g1',
          date: '2025-01-15',
          opponent: 'Opp',
          pitcherId: 'p1',
          pitcher: { id: 'p1', name: 'P' },
          isComplete: false,
          atBats: [],
          createdAt: new Date().toISOString(),
        },
      ],
      pitchers: [{ id: 'p1', name: 'Pitcher' }],
      batters: [{ id: 'b1', name: 'Batter' }],
    }
    const result = await importBackup(validBackup)
    expect(result.success).toBe(true)
  })
})

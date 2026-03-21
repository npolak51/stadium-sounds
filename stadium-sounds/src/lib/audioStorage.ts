// Store audio files in IndexedDB for offline PWA support
import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'

interface AudioFilesDB extends DBSchema {
  files: {
    key: string
    value: { path: string; blob: Blob; fileName: string; hash?: string; createdAt?: number }
  }
  hashes: {
    key: string // SHA-256 hash
    value: { hash: string; path: string }
  }
}

const AUDIO_DB_NAME = 'stadium-sounds-audio'
const AUDIO_DB_VERSION = 2

let audioDbPromise: Promise<IDBPDatabase<AudioFilesDB>> | null = null

function getAudioDB() {
  if (!audioDbPromise) {
    audioDbPromise = openDB<AudioFilesDB>(AUDIO_DB_NAME, AUDIO_DB_VERSION, {
      upgrade(db, _oldVersion, newVersion) {
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'path' })
        }
        if (newVersion === 2 && !db.objectStoreNames.contains('hashes')) {
          db.createObjectStore('hashes', { keyPath: 'hash' })
        }
      }
    })
  }
  return audioDbPromise
}

async function computeFileHash(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Returns true if stored, false if skipped (duplicate) */
export async function storeAudioFile(
  path: string,
  blob: Blob,
  fileName: string
): Promise<{ stored: boolean }> {
  const db = await getAudioDB()
  const hash = await computeFileHash(blob)

  const existing = await db.get('hashes', hash)
  if (existing) {
    return { stored: false }
  }

  await db.put('files', { path, blob, fileName, hash, createdAt: Date.now() })
  await db.put('hashes', { hash, path })
  return { stored: true }
}

export async function getAudioBlob(path: string): Promise<Blob | null> {
  const db = await getAudioDB()
  const record = await db.get('files', path)
  return record?.blob ?? null
}

export async function deleteAudioFile(path: string): Promise<void> {
  const db = await getAudioDB()
  const record = await db.get('files', path)
  if (record?.hash) {
    await db.delete('hashes', record.hash)
  }
  await db.delete('files', path)
}

export async function getAllAudioPaths(): Promise<string[]> {
  const db = await getAudioDB()
  const records = await db.getAll('files')
  return records.map(r => r.path)
}

export async function getStorageUsage(): Promise<{ used: number; fileCount: number }> {
  const db = await getAudioDB()
  const records = await db.getAll('files')
  const used = records.reduce((sum, r) => sum + r.blob.size, 0)
  return { used, fileCount: records.length }
}

export async function getAllStoredFiles(): Promise<{ path: string; fileName: string }[]> {
  const db = await getAudioDB()
  const records = await db.getAll('files')
  // Newest imports first (records without createdAt sort last)
  records.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
  return records.map(r => ({ path: r.path, fileName: r.fileName }))
}

/** Deletes all audio files from storage. Caller should also remove assignments. */
export async function clearAllAudioFiles(): Promise<void> {
  const db = await getAudioDB()
  const tx = db.transaction(['files', 'hashes'], 'readwrite')
  await Promise.all([
    tx.objectStore('files').clear(),
    tx.objectStore('hashes').clear()
  ])
  await tx.done
}

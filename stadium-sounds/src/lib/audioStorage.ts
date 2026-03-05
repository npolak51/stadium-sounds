// Store audio files in IndexedDB for offline PWA support
import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'

interface AudioFilesDB extends DBSchema {
  files: {
    key: string // filePath or blob key
    value: { path: string; blob: Blob; fileName: string }
  }
}

const AUDIO_DB_NAME = 'stadium-sounds-audio'
const AUDIO_DB_VERSION = 1

let audioDbPromise: Promise<IDBPDatabase<AudioFilesDB>> | null = null

function getAudioDB() {
  if (!audioDbPromise) {
    audioDbPromise = openDB<AudioFilesDB>(AUDIO_DB_NAME, AUDIO_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'path' })
        }
      }
    })
  }
  return audioDbPromise
}

export async function storeAudioFile(path: string, blob: Blob, fileName: string): Promise<void> {
  const db = await getAudioDB()
  await db.put('files', { path, blob, fileName })
}

export async function getAudioBlob(path: string): Promise<Blob | null> {
  const db = await getAudioDB()
  const record = await db.get('files', path)
  return record?.blob ?? null
}

export async function deleteAudioFile(path: string): Promise<void> {
  const db = await getAudioDB()
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
  return records.map(r => ({ path: r.path, fileName: r.fileName }))
}

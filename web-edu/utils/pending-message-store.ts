/**
 * IndexedDB-based storage for pending messages during streaming.
 * Allows recovery of in-progress messages after page refresh.
 */

const DB_NAME = 'eduai-pending-messages'
const DB_VERSION = 1
const STORE_NAME = 'pending-messages'

interface PendingMessage {
  agentId: string
  conversationId: string
  message: string
  files: Array<{
    name: string
    type: string
    size: number
    data: ArrayBuffer
  }>
  timestamp: number
}

/**
 * Open IndexedDB connection
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'agentId' })
      }
    }
  })
}

/**
 * Convert File objects to storable format
 */
async function filesToStorable(files: File[]): Promise<PendingMessage['files']> {
  return Promise.all(
    files.map(async (file) => ({
      name: file.name,
      type: file.type,
      size: file.size,
      data: await file.arrayBuffer(),
    }))
  )
}

/**
 * Convert stored data back to File objects
 */
function storableToFiles(stored: PendingMessage['files']): File[] {
  return stored.map(
    (item) => new File([item.data], item.name, { type: item.type })
  )
}

/**
 * Save pending message to IndexedDB
 */
export async function savePendingMessage(
  agentId: string,
  conversationId: string,
  message: string,
  files: File[]
): Promise<void> {
  try {
    // Convert files BEFORE opening transaction to avoid TransactionInactiveError
    // IndexedDB transactions auto-close when the event loop advances (during await)
    const storableFiles = await filesToStorable(files)

    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)

    const pendingMessage: PendingMessage = {
      agentId,
      conversationId,
      message,
      files: storableFiles,
      timestamp: Date.now(),
    }

    await new Promise<void>((resolve, reject) => {
      const request = store.put(pendingMessage)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })

    db.close()
  } catch (error) {
    console.warn('Failed to save pending message:', error)
  }
}

/**
 * Load pending message from IndexedDB
 */
export async function loadPendingMessage(
  agentId: string
): Promise<{ conversationId: string; message: string; files: File[] } | null> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)

    const result = await new Promise<PendingMessage | undefined>((resolve, reject) => {
      const request = store.get(agentId)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    db.close()

    if (!result) return null

    // Check if message is not too old (5 minutes max)
    const MAX_AGE = 5 * 60 * 1000
    if (Date.now() - result.timestamp > MAX_AGE) {
      await clearPendingMessage(agentId)
      return null
    }

    return {
      conversationId: result.conversationId,
      message: result.message,
      files: storableToFiles(result.files),
    }
  } catch (error) {
    console.warn('Failed to load pending message:', error)
    return null
  }
}

/**
 * Clear pending message from IndexedDB
 */
export async function clearPendingMessage(agentId: string): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(agentId)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })

    db.close()
  } catch (error) {
    console.warn('Failed to clear pending message:', error)
  }
}

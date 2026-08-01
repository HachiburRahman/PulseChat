import { initializeApp, getApps } from 'firebase/app'
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseReady = Boolean(config.apiKey && config.storageBucket)

const app = firebaseReady ? getApps()[0] || initializeApp(config) : null
const storage = app ? getStorage(app) : null

/**
 * Media bytes go browser → Firebase Storage directly; only the resulting URL
 * ever travels through the chat. Without Firebase credentials we fall back to a
 * local object URL so the upload UI is still fully testable.
 */
export function uploadFile(file, { userId = 'anon', onProgress } = {}) {
  if (!storage) {
    return new Promise((resolve) => {
      let pct = 0
      const tick = setInterval(() => {
        pct = Math.min(100, pct + 12 + Math.random() * 18)
        onProgress?.(Math.round(pct))
        if (pct >= 100) {
          clearInterval(tick)
          resolve({ url: URL.createObjectURL(file), name: file.name, size: file.size, local: true })
        }
      }, 130)
    })
  }

  const safeName = file.name.replace(/[^\w.-]+/g, '_')
  const path = `uploads/${userId}/${Date.now()}_${safeName}`
  const task = uploadBytesResumable(ref(storage, path), file, { contentType: file.type })

  return new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (snap) => onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      async () => {
        const url = await getDownloadURL(task.snapshot.ref)
        resolve({ url, name: file.name, size: file.size, local: false })
      },
    )
  })
}

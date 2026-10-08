const CACHE_NAME = 'pharmakin-shell-v2'
const SHELL = [
  '/',
  '/manifest.webmanifest',
  '/pharmakin-logo.png',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-192-maskable.png',
  '/icon-512.png',
  '/icon-512-maskable.png',
]
const DB_NAME = 'pharmakin-offline'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('pharmakin-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone()
        void caches.open(CACHE_NAME).then((cache) => cache.put('/', copy))
      }
      return response
    }).catch(async () => (await caches.match('/')) || Response.error()))
    return
  }
  if (url.pathname.startsWith('/_next/static/') || SHELL.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone()
        void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
      }
      return response
    })))
  }
})

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function syncOutbox() {
  const database = await openDatabase()
  const queued = await new Promise((resolve, reject) => {
    const transaction = database.transaction('outbox', 'readonly')
    const request = transaction.objectStore('outbox').getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  queued.sort((left, right) => left.createdAt - right.createdAt)
  const idMap = new Map()
  for (const item of queued) {
    try {
      let body = item.body
      let target = item.url
      for (const [localId, serverId] of idMap) {
        body = body ? body.split(localId).join(serverId) : body
        target = target.split(localId).join(serverId)
      }
      const response = await fetch(target, {
        method: item.method,
        headers: Object.fromEntries(item.headers),
        body,
        credentials: 'include',
      })
      if (!response.ok) break
      if (item.localResult?.product?.id) {
        const saved = await response.clone().json().catch(() => null)
        if (saved?.product?.id) idMap.set(item.localResult.product.id, saved.product.id)
      }
      if (item.localResult?.session?.id) {
        const saved = await response.clone().json().catch(() => null)
        if (saved?.session?.id) idMap.set(item.localResult.session.id, saved.session.id)
      }
      await new Promise((resolve, reject) => {
        const transaction = database.transaction(['outbox', 'api-cache'], 'readwrite')
        transaction.objectStore('outbox').delete(item.id)
        transaction.objectStore('api-cache').clear()
        transaction.oncomplete = resolve
        transaction.onerror = () => reject(transaction.error)
      })
    } catch {
      break
    }
  }
  database.close()
  const clients = await self.clients.matchAll({ type: 'window' })
  for (const client of clients) client.postMessage({ type: 'PHARMAKIN_SYNC_COMPLETE' })
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'pharmakin-outbox') {
    event.waitUntil(
      self.navigator.locks
        ? self.navigator.locks.request('pharmakin-offline-outbox', syncOutbox)
        : syncOutbox(),
    )
  }
})

'use client'

type ApiCacheEntry = { key: string; body: unknown; savedAt: number }
type QueuedRequest = {
  id: string
  url: string
  method: string
  headers: Array<[string, string]>
  body: string | null
  localResult?: Record<string, unknown>
  createdAt: number
}

const DB_NAME = 'pharmakin-offline'
const DB_VERSION = 1
const CACHE_STORE = 'api-cache'
const QUEUE_STORE = 'outbox'
const installedKey = '__pharmakinOfflineInstalled'
type OfflineWindow = Window & { [installedKey]?: boolean }
let rawFetch: typeof fetch | null = null
let activeSync: Promise<void> | null = null

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(CACHE_STORE)) database.createObjectStore(CACHE_STORE, { keyPath: 'key' })
      if (!database.objectStoreNames.contains(QUEUE_STORE)) database.createObjectStore(QUEUE_STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Impossible d’ouvrir la base hors ligne'))
  })
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode)
    const request = run(transaction.objectStore(storeName))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Erreur de stockage hors ligne'))
    transaction.oncomplete = () => database.close()
    transaction.onerror = () => {
      database.close()
      reject(transaction.error ?? new Error('Erreur de transaction hors ligne'))
    }
  })
}

async function cacheResponse(key: string, body: unknown) {
  await withStore(CACHE_STORE, 'readwrite', (store) => store.put({ key, body, savedAt: Date.now() } satisfies ApiCacheEntry))
}

async function clearApiCache() {
  await withStore(CACHE_STORE, 'readwrite', (store) => store.clear())
}

async function readCachedResponse(key: string) {
  return withStore(CACHE_STORE, 'readonly', (store) => store.get(key)) as Promise<ApiCacheEntry | undefined>
}

function apiUrl(input: RequestInfo | URL) {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  return new URL(raw, window.location.origin)
}

function currentPharmacyId() {
  try {
    const stored = localStorage.getItem('pharmakin-store')
    if (!stored) return null
    const value = JSON.parse(stored) as { state?: { pharmacy?: { id?: unknown } } }
    return typeof value.state?.pharmacy?.id === 'string' ? value.state.pharmacy.id : null
  } catch {
    return null
  }
}

function cacheKey(url: URL) {
  return `${currentPharmacyId() ?? 'public'}::${url.href}`
}

function apiUrlFromCacheKey(key: string) {
  return new URL(key.slice(key.indexOf('::') + 2))
}

function shouldCache(url: URL, method: string) {
  return method === 'GET' && url.origin === window.location.origin && url.pathname.startsWith('/api/') &&
    !url.pathname.startsWith('/api/admin/') &&
    !url.pathname.startsWith('/api/auth/') &&
    url.pathname !== '/api/subscription/status' &&
    url.pathname !== '/api/pharmacy'
}

function supportsOfflineWrite(url: URL, method: string) {
  if (url.origin !== window.location.origin) return false
  const path = url.pathname
  return (
    (path === '/api/products' && ['POST'].includes(method)) ||
    (/^\/api\/products\/[^/]+$/.test(path) && ['PUT', 'DELETE'].includes(method)) ||
    (['/api/stock/entry', '/api/stock/exit', '/api/sales', '/api/sessions'].includes(path) && method === 'POST') ||
    (/^\/api\/sessions\/[^/]+\/end$/.test(path) && method === 'POST')
  )
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-PharmaKin-Offline': 'true' },
  })
}

function localMutationResult(url: URL, method: string, bodyText: string | null) {
  let body: Record<string, unknown> = {}
  try {
    if (bodyText) body = JSON.parse(bodyText) as Record<string, unknown>
  } catch {
    body = {}
  }
  const id = `offline-${crypto.randomUUID()}`
  const now = new Date()
  if (url.pathname === '/api/products' && method === 'POST') {
    const product = {
      ...body,
      id,
      pharmacyId: body.pharmacyId,
      quantity: Number(body.quantity ?? 0),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }
    return { queued: true, product } satisfies Record<string, unknown>
  }
  if (/^\/api\/products\/[^/]+$/.test(url.pathname) && method === 'PUT') {
    return { queued: true, product: { ...body, id: url.pathname.split('/').pop(), updatedAt: now.toISOString() } } satisfies Record<string, unknown>
  }
  if (url.pathname === '/api/sales' && method === 'POST') {
    const items = Array.isArray(body.items) ? body.items as Record<string, unknown>[] : []
    const itemRows = items.map((item, index) => ({
      id: `${id}-item-${index}`,
      saleId: id,
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: Number(item.quantity) * Number(item.unitPrice),
    }))
    const total = itemRows.reduce((sum, item) => sum + item.lineTotal, 0)
    return {
      queued: true,
      sale: {
        id,
        pharmacyId: body.pharmacyId,
        sellerId: body.sellerId,
        invoiceNumber: `HORS-LIGNE-${now.getTime().toString().slice(-6)}`,
        clientName: body.clientName ?? null,
        total,
        itemCount: itemRows.reduce((sum, item) => sum + Number(item.quantity), 0),
        createdAt: now.toISOString(),
        dateStr: now.toLocaleDateString('fr-FR'),
        timeStr: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        items: itemRows,
      },
    } satisfies Record<string, unknown>
  }
  if (url.pathname === '/api/sessions' && method === 'POST') {
    const time = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    return {
      queued: true,
      session: {
        id,
        pharmacyId: body.pharmacyId,
        sellerId: body.sellerId,
        startTime: now.toISOString(),
        endTime: null,
        startStr: time,
        endStr: null,
        open: true,
      },
    } satisfies Record<string, unknown>
  }
  if (url.pathname === '/api/stock/entry' || url.pathname === '/api/stock/exit') {
    return { queued: true, movement: { id, pharmacyId: body.pharmacyId, productId: body.productId } } satisfies Record<string, unknown>
  }
  return { queued: true, id, ok: true } satisfies Record<string, unknown>
}

async function applyOptimisticCache(url: URL, method: string, bodyText: string | null, result: Record<string, unknown>) {
  let input: Record<string, unknown> = {}
  try {
    if (bodyText) input = JSON.parse(bodyText) as Record<string, unknown>
  } catch {
    return
  }
  const records = await withStore(CACHE_STORE, 'readonly', (store) => store.getAll()) as ApiCacheEntry[]
  for (const entry of records) {
    let changed = false
    let cached = entry.body as Record<string, unknown>
    const cacheUrl = apiUrlFromCacheKey(entry.key)
    if (cacheUrl.pathname === '/api/products' && Array.isArray(cached.products)) {
      let products = cached.products as Record<string, unknown>[]
      const resultProduct = result.product as Record<string, unknown> | undefined
      const targetId = url.pathname.split('/').pop()
      if (url.pathname === '/api/products' && method === 'POST' && resultProduct) {
        if (cacheUrl.searchParams.get('pharmacyId') === input.pharmacyId) {
          products = [resultProduct, ...products.filter((product) => product.id !== resultProduct.id)]
          changed = true
        }
      } else if (method === 'PUT' && resultProduct && cacheUrl.searchParams.get('pharmacyId') === input.pharmacyId) {
        products = products.map((product) => product.id === targetId ? { ...product, ...resultProduct } : product)
        changed = true
      } else if (method === 'DELETE' && cacheUrl.searchParams.get('pharmacyId') === input.pharmacyId) {
        products = products.filter((product) => product.id !== targetId)
        changed = true
      } else if (url.pathname === '/api/stock/entry' || url.pathname === '/api/stock/exit' || url.pathname === '/api/sales') {
        const matchesPharmacy = cacheUrl.searchParams.get('pharmacyId') === input.pharmacyId
        if (matchesPharmacy) {
          products = products.map((product) => {
            const saleItems = url.pathname === '/api/sales' && Array.isArray(input.items) ? input.items as Record<string, unknown>[] : []
            const saleItem = saleItems.find((item) => item.productId === product.id)
            const change = url.pathname === '/api/stock/entry'
              ? (product.id === input.productId ? Number(input.quantity) : 0)
              : url.pathname === '/api/stock/exit'
                ? (product.id === input.productId ? -Number(input.quantity) : 0)
                : saleItem ? -Number(saleItem.quantity) : 0
            if (!change) return product
            changed = true
            return { ...product, quantity: Math.max(0, Number(product.quantity ?? 0) + change) }
          })
        }
      }
      if (changed) cached = { ...cached, products }
    }
    if (cacheUrl.pathname === '/api/sales' && Array.isArray(cached.sales) && url.pathname === '/api/sales' && method === 'POST') {
      const sale = result.sale as Record<string, unknown> | undefined
      if (sale && cacheUrl.searchParams.get('pharmacyId') === input.pharmacyId) {
        cached = { ...cached, sales: [sale, ...(cached.sales as Record<string, unknown>[])] }
        changed = true
      }
    }
    if (cacheUrl.pathname === '/api/dashboard' && url.pathname === '/api/sales' && method === 'POST' &&
      cacheUrl.searchParams.get('pharmacyId') === input.pharmacyId && cacheUrl.searchParams.get('sellerId') === input.sellerId) {
      const sale = result.sale as { total?: number; itemCount?: number } | undefined
      const today = cached.today as Record<string, unknown> | undefined
      if (sale && today) {
        const seller = today.seller as Record<string, unknown> | null | undefined
        cached = {
          ...cached,
          today: {
            ...today,
            salesCount: Number(today.salesCount ?? 0) + 1,
            revenue: Number(today.revenue ?? 0) + Number(sale.total ?? 0),
            itemsSold: Number(today.itemsSold ?? 0) + Number(sale.itemCount ?? 0),
            seller: seller ? {
              ...seller,
              salesCount: Number(seller.salesCount ?? 0) + 1,
              revenue: Number(seller.revenue ?? 0) + Number(sale.total ?? 0),
              itemsSold: Number(seller.itemsSold ?? 0) + Number(sale.itemCount ?? 0),
            } : seller,
          },
        }
        changed = true
      }
    }
    if (cacheUrl.pathname === '/api/dashboard' && url.pathname === '/api/sessions' && method === 'POST' &&
      cacheUrl.searchParams.get('pharmacyId') === input.pharmacyId) {
      cached = { ...cached, openSession: (result.session as Record<string, unknown>) ?? null }
      changed = true
    }
    if (changed) await cacheResponse(entry.key, cached)
  }
}

async function enqueue(item: QueuedRequest) {
  await withStore(QUEUE_STORE, 'readwrite', (store) => store.put(item))
  window.dispatchEvent(new CustomEvent('pharmakin-sync-state', { detail: { queued: true } }))
  const serviceWorker = navigator.serviceWorker?.controller
  if (serviceWorker) {
    navigator.serviceWorker.ready
      .then((registration) => {
        if ('sync' in registration) return (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register('pharmakin-outbox')
        return undefined
      })
      .catch(() => undefined)
  }
}

export async function pendingOfflineWrites() {
  const items = await withStore(QUEUE_STORE, 'readonly', (store) => store.getAll()) as QueuedRequest[]
  return items.length
}

async function runOfflineSync() {
  if (!navigator.onLine || !rawFetch) return
  const items = await withStore(QUEUE_STORE, 'readonly', (store) => store.getAll()) as QueuedRequest[]
  items.sort((left, right) => left.createdAt - right.createdAt)
  const idMap = new Map<string, string>()
  for (const item of items) {
    try {
      let requestBody = item.body
      for (const [localId, serverId] of idMap) requestBody = requestBody?.replaceAll(localId, serverId) ?? null
      const url = new URL(item.url)
      for (const [localId, serverId] of idMap) {
        if (url.pathname.includes(localId)) url.pathname = url.pathname.replace(localId, serverId)
      }
      const response = await rawFetch(url.href, {
        method: item.method,
        headers: Object.fromEntries(item.headers),
        body: requestBody,
        credentials: 'same-origin',
      })
      if (!response.ok) {
        if (response.status >= 500 || response.status === 429) break
        window.dispatchEvent(new CustomEvent('pharmakin-sync-error', { detail: { message: `Une opération hors ligne a été refusée (${response.status}). Vérifiez votre stock et vos données.` } }))
        break
      }
      if (item.localResult?.product && typeof (item.localResult.product as { id?: unknown }).id === 'string') {
        const localId = (item.localResult.product as { id: string }).id
        const synced = await response.clone().json().catch(() => null) as { product?: { id?: unknown } } | null
        if (typeof synced?.product?.id === 'string') idMap.set(localId, synced.product.id)
      }
      if (item.localResult?.session && typeof (item.localResult.session as { id?: unknown }).id === 'string') {
        const localId = (item.localResult.session as { id: string }).id
        const synced = await response.clone().json().catch(() => null) as { session?: { id?: unknown } } | null
        if (typeof synced?.session?.id === 'string') idMap.set(localId, synced.session.id)
      }
      await withStore(QUEUE_STORE, 'readwrite', (store) => store.delete(item.id))
      await clearApiCache()
      window.dispatchEvent(new CustomEvent('pharmakin-sync-state', { detail: { synced: true } }))
    } catch {
      break
    }
  }
}

export function syncOfflineWrites() {
  if (activeSync) return activeSync
  const current: Promise<void> = ('locks' in navigator)
    ? navigator.locks.request('pharmakin-offline-outbox', async () => {
      await runOfflineSync()
    }).then(async (sync) => {
      await sync
    })
    : runOfflineSync()
  activeSync = current
  return current.finally(() => {
    if (activeSync === current) activeSync = null
  })
}

export function installOfflineFetch() {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return
  const target = window as OfflineWindow
  if (target[installedKey]) return
  target[installedKey] = true
  const originalFetch = window.fetch.bind(window)
  rawFetch = originalFetch

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let url: URL
    try {
      url = apiUrl(input)
    } catch {
      return originalFetch(input, init)
    }
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    const cacheable = shouldCache(url, method)
    try {
      const response = await originalFetch(input, init)
      if (cacheable && response.ok) {
        const body = await response.clone().json().catch(() => undefined)
        if (body !== undefined) await cacheResponse(cacheKey(url), body).catch((error) => {
          console.error('[offline] Failed to cache API response', error)
        })
      }
      return response
    } catch (error) {
      if (cacheable) {
        const key = cacheKey(url)
        let cached = await readCachedResponse(key).catch(() => undefined)
        if (!cached && url.searchParams.has('q')) {
          const fallbackUrl = new URL(url)
          fallbackUrl.searchParams.delete('q')
          cached = await readCachedResponse(cacheKey(fallbackUrl)).catch(() => undefined)
          if (cached) {
            const q = url.searchParams.get('q')?.trim().toLocaleLowerCase()
            const body = cached.body as Record<string, unknown>
            if (q && Array.isArray(body.products)) {
              cached = {
                ...cached,
                body: {
                  ...body,
                  products: (body.products as Record<string, unknown>[]).filter((product) =>
                    [product.name, product.category, product.barcode].some((value) =>
                      typeof value === 'string' && value.toLocaleLowerCase().includes(q),
                    ),
                  ),
                },
              }
            } else if (q && Array.isArray(body.sales)) {
              cached = {
                ...cached,
                body: {
                  ...body,
                  sales: (body.sales as Record<string, unknown>[]).filter((sale) =>
                    [sale.invoiceNumber, sale.clientName].some((value) =>
                      typeof value === 'string' && value.toLocaleLowerCase().includes(q),
                    ),
                  ),
                },
              }
            }
          }
        }
        if (cached) {
          return jsonResponse(cached.body)
        }
      }
      if (supportsOfflineWrite(url, method)) {
        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
        let requestBody = typeof init?.body === 'string' ? init.body : null
        if (requestBody === null && input instanceof Request) {
          try {
            requestBody = await input.clone().text()
          } catch {
            requestBody = null
          }
        }
        const result = localMutationResult(url, method, requestBody)
        await applyOptimisticCache(url, method, requestBody, result)
        await enqueue({
          id: crypto.randomUUID(),
          url: url.href,
          method,
          headers: [...headers.entries()],
          body: requestBody,
          localResult: result,
          createdAt: Date.now(),
        })
        return jsonResponse(result)
      }
      throw error
    }
  }

  window.addEventListener('online', () => void syncOfflineWrites())
  void syncOfflineWrites()
}

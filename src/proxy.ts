import { NextRequest, NextResponse } from 'next/server'

const SESSION_COOKIE = 'pharmakin-vendor-session'
const encoder = new TextEncoder()

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(normalized + '='.repeat((4 - (normalized.length % 4)) % 4))
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function encodeBase64Url(value: Uint8Array) {
  let binary = ''
  for (const byte of value) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function signature(payload: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return encodeBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload))))
}

function sameText(left: string, right: string) {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return difference === 0
}

function publicRoute(request: NextRequest) {
  const path = request.nextUrl.pathname
  return (
    path === '/api' ||
    path === '/api/' ||
    path === '/api/public/pharmacies' ||
    path === '/api/auth/vendor/session' ||
    path === '/api/auth/vendor/password-reset' ||
    (path === '/api/pharmacy' && (request.method === 'GET' || request.method === 'POST')) ||
    path.startsWith('/api/admin/')
  )
}

export async function proxy(request: NextRequest) {
  if (publicRoute(request)) return NextResponse.next()

  const token = request.cookies.get(SESSION_COOKIE)?.value
  const secret = process.env.PHARMAKIN_VENDOR_SESSION_SECRET || process.env.PHARMAKIN_ADMIN_SESSION_SECRET
  if (!token || !secret) return NextResponse.json({ error: 'Connexion vendeur requise' }, { status: 401 })

  const [payload, suppliedSignature, extra] = token.split('.')
  if (!payload || !suppliedSignature || extra !== undefined) {
    return NextResponse.json({ error: 'Session vendeur invalide' }, { status: 401 })
  }
  let session: { pharmacyId?: unknown; sellerId?: unknown; expiresAt?: unknown }
  try {
    const expectedSignature = await signature(payload, secret)
    if (!sameText(expectedSignature, suppliedSignature)) {
      return NextResponse.json({ error: 'Session vendeur invalide' }, { status: 401 })
    }
    session = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload)))
  } catch {
    return NextResponse.json({ error: 'Session vendeur invalide' }, { status: 401 })
  }
  if (
    typeof session.pharmacyId !== 'string' ||
    typeof session.sellerId !== 'string' ||
    typeof session.expiresAt !== 'number' ||
    session.expiresAt <= Math.floor(Date.now() / 1000)
  ) {
    return NextResponse.json({ error: 'Session vendeur expirée' }, { status: 401 })
  }

  let requestedPharmacyId = request.nextUrl.searchParams.get('pharmacyId')
  const pharmacyPath = request.nextUrl.pathname.match(/^\/api\/pharmacy\/([^/]+)/)
  if (pharmacyPath) requestedPharmacyId = pharmacyPath[1]

  if (!requestedPharmacyId && request.method !== 'GET' && request.headers.get('content-type')?.includes('application/json')) {
    const body = await request.clone().json().catch(() => null) as { pharmacyId?: unknown } | null
    if (typeof body?.pharmacyId === 'string') requestedPharmacyId = body.pharmacyId
  }
  if (!requestedPharmacyId && request.method !== 'GET' && request.headers.get('content-type')?.includes('multipart/form-data')) {
    const form = await request.clone().formData().catch(() => null)
    const formPharmacyId = form?.get('pharmacyId')
    if (typeof formPharmacyId === 'string') requestedPharmacyId = formPharmacyId
  }
  if (requestedPharmacyId && requestedPharmacyId !== session.pharmacyId) {
    return NextResponse.json({ error: 'Accès refusé à cette pharmacie' }, { status: 403 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*'],
}

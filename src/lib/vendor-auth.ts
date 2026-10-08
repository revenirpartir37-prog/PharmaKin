import 'server-only'

import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import type { NextRequest, NextResponse } from 'next/server'

const scrypt = promisify(scryptCallback)
const COOKIE_NAME = 'pharmakin-vendor-session'
const SESSION_SECONDS = 60 * 60 * 24 * 14

export interface VendorSession {
  pharmacyId: string
  sellerId: string
  expiresAt: number
}

function getSecret() {
  const secret = process.env.PHARMAKIN_VENDOR_SESSION_SECRET || process.env.PHARMAKIN_ADMIN_SESSION_SECRET
  if (!secret) throw new Error('PHARMAKIN_VENDOR_SESSION_SECRET is not configured')
  return secret
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16)
  const derived = (await scrypt(password, salt, 64)) as Buffer
  return `scrypt$${salt.toString('base64url')}$${derived.toString('base64url')}`
}

export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, saltText, hashText] = encoded.split('$')
  if (algorithm !== 'scrypt' || !saltText || !hashText) return false
  const expected = Buffer.from(hashText, 'base64url')
  const actual = (await scrypt(password, Buffer.from(saltText, 'base64url'), expected.length)) as Buffer
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

function signature(payload: string) {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url')
}

export function setVendorSession(response: NextResponse, pharmacyId: string, sellerId: string) {
  const payload = Buffer.from(JSON.stringify({
    pharmacyId,
    sellerId,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
  } satisfies VendorSession)).toString('base64url')
  response.cookies.set(COOKIE_NAME, `${payload}.${signature(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_SECONDS,
  })
}

export function clearVendorSession(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  })
}

export function getVendorSession(request: NextRequest): VendorSession | null {
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) return null
  const [payload, receivedSignature, extra] = token.split('.')
  if (!payload || !receivedSignature || extra !== undefined) return null
  const expected = Buffer.from(signature(payload))
  const received = Buffer.from(receivedSignature)
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString()) as VendorSession
    if (
      typeof session.pharmacyId !== 'string' ||
      typeof session.sellerId !== 'string' ||
      typeof session.expiresAt !== 'number' ||
      session.expiresAt <= Math.floor(Date.now() / 1000)
    ) return null
    return session
  } catch {
    return null
  }
}

export function requireVendorSession(request: NextRequest) {
  return getVendorSession(request)
}

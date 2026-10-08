import 'server-only'

import { createHmac, createHash, timingSafeEqual } from 'node:crypto'
import type { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME = 'pharmakin-admin-session'
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60

function getSessionSecret() {
  const secret = process.env.PHARMAKIN_ADMIN_SESSION_SECRET
  if (!secret) throw new Error('PHARMAKIN_ADMIN_SESSION_SECRET is not configured')
  return secret
}

function sign(value: string) {
  return createHmac('sha256', getSessionSecret()).update(value).digest('base64url')
}

export function isAdminPasswordValid(password: string) {
  const configuredPassword = process.env.PHARMAKIN_ADMIN_PASSWORD
  if (!configuredPassword) throw new Error('PHARMAKIN_ADMIN_PASSWORD is not configured')

  const submittedHash = createHash('sha256').update(password).digest()
  const configuredHash = createHash('sha256').update(configuredPassword).digest()
  return timingSafeEqual(submittedHash, configuredHash)
}

export function isAdminRequest(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) return false

  const [issuedAtText, signature, extra] = token.split('.')
  if (!issuedAtText || !signature || extra !== undefined || !/^\d+$/.test(issuedAtText)) {
    return false
  }

  const issuedAt = Number(issuedAtText)
  const now = Math.floor(Date.now() / 1000)
  if (issuedAt > now || now - issuedAt > SESSION_MAX_AGE_SECONDS) return false

  const expectedBytes = Buffer.from(sign(issuedAtText))
  const actualBytes = Buffer.from(signature)
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes)
}

export function setAdminSession(response: NextResponse) {
  const issuedAt = String(Math.floor(Date.now() / 1000))
  response.cookies.set(COOKIE_NAME, `${issuedAt}.${sign(issuedAt)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
}

export function clearAdminSession(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  })
}

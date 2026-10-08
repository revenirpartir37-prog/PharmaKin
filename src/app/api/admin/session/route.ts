import { NextRequest, NextResponse } from 'next/server'
import {
  clearAdminSession,
  isAdminPasswordValid,
  isAdminRequest,
  setAdminSession,
} from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  return NextResponse.json({ authenticated: isAdminRequest(request) })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (
      typeof body.password !== 'string' ||
      !body.password ||
      body.password.length > 256
    ) {
      return NextResponse.json({ error: 'Mot de passe requis' }, { status: 400 })
    }

    if (!isAdminPasswordValid(body.password)) {
      return NextResponse.json({ error: 'Mot de passe incorrect' }, { status: 401 })
    }

    const response = NextResponse.json({ authenticated: true })
    setAdminSession(response)
    return response
  } catch (error) {
    console.error('[POST /api/admin/session]', error)
    return NextResponse.json({ error: 'Service administrateur indisponible' }, { status: 503 })
  }
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false })
  clearAdminSession(response)
  return response
}

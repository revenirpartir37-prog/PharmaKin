import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  clearVendorSession,
  getVendorSession,
  setVendorSession,
  verifyPassword,
} from '@/lib/vendor-auth'

export async function GET(request: NextRequest) {
  const session = getVendorSession(request)
  if (!session) return NextResponse.json({ authenticated: false })
  const pharmacy = await db.pharmacy.findUnique({
    where: { id: session.pharmacyId },
    select: { id: true, name: true, suspended: true, sellers: { select: { id: true } } },
  })
  const sellerExists = pharmacy?.sellers.some((seller) => seller.id === session.sellerId)
  if (!pharmacy || pharmacy.suspended || !sellerExists) {
    const response = NextResponse.json({ authenticated: false })
    clearVendorSession(response)
    return response
  }
  return NextResponse.json({
    authenticated: true,
    pharmacy: { id: pharmacy.id, name: pharmacy.name },
    sellerId: session.sellerId,
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (typeof body.email !== 'string' || typeof body.password !== 'string') {
      return NextResponse.json({ error: 'E-mail et mot de passe requis' }, { status: 400 })
    }
    const pharmacy = await db.pharmacy.findUnique({
      where: { email: body.email.trim().toLowerCase() },
      include: { sellers: { orderBy: { createdAt: 'asc' }, take: 1 } },
    })
    if (!pharmacy || pharmacy.suspended || !pharmacy.passwordHash || !(await verifyPassword(body.password, pharmacy.passwordHash))) {
      return NextResponse.json({ error: 'E-mail ou mot de passe incorrect, ou compte suspendu' }, { status: 401 })
    }
    const seller = pharmacy.sellers[0]
    if (!seller) return NextResponse.json({ error: 'Aucun vendeur associé à ce compte' }, { status: 403 })
    const response = NextResponse.json({
      authenticated: true,
      pharmacy: { id: pharmacy.id, name: pharmacy.name },
      sellerId: seller.id,
    })
    setVendorSession(response, pharmacy.id, seller.id)
    return response
  } catch (error) {
    console.error('[POST /api/auth/vendor/session]', error)
    return NextResponse.json({ error: 'Connexion temporairement indisponible' }, { status: 500 })
  }
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false })
  clearVendorSession(response)
  return response
}

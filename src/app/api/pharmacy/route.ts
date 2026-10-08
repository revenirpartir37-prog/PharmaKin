import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { todayStr, timeStr } from '@/lib/format'
import { hashPassword, setVendorSession } from '@/lib/vendor-auth'

/**
 * GET /api/pharmacy  -> list all configured pharmacies
 * POST /api/pharmacy  -> create pharmacy + sellers (onboarding)
 *
 * Body for POST:
 *  { name, phone?, address?, latitude?, longitude?, sellerName, secondSellerName? }
 */
export async function GET() {
  const pharmacies = await db.pharmacy.findMany({
    select: {
      id: true, name: true, phone: true, address: true, latitude: true, longitude: true, currency: true,
      sellers: { select: { id: true, pharmacyId: true, name: true, isPrimary: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ pharmacies })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, password, phone, address, latitude, longitude, sellerName, secondSellerName } = body as {
      name: string
      email: string
      password: string
      phone?: string
      address?: string
      latitude?: number | null
      longitude?: number | null
      sellerName: string
      secondSellerName?: string
    }

    if (!name || !sellerName || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Le nom de la pharmacie, du vendeur et un e-mail valide sont requis' }, { status: 400 })
    }
    if (typeof password !== 'string' || password.length < 10 || password.length > 128) {
      return NextResponse.json({ error: 'Choisissez un mot de passe de 10 à 128 caractères' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const existing = await db.pharmacy.findUnique({ where: { email: normalizedEmail }, select: { id: true } })
    if (existing) return NextResponse.json({ error: 'Un compte utilise déjà cette adresse e-mail' }, { status: 409 })

    const pharmacy = await db.pharmacy.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash: await hashPassword(password),
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        latitude: typeof latitude === 'number' ? latitude : null,
        longitude: typeof longitude === 'number' ? longitude : null,
        currency: 'FC',
        sellers: {
          create: [
            { name: sellerName.trim(), isPrimary: true },
            ...(secondSellerName && secondSellerName.trim()
              ? [{ name: secondSellerName.trim(), isPrimary: false }]
              : []),
          ],
        },
      },
      include: { sellers: true },
    })

    const { email: _email, passwordHash: _passwordHash, suspended: _suspended, ...publicPharmacy } = pharmacy
    const response = NextResponse.json({ pharmacy: publicPharmacy })
    setVendorSession(response, pharmacy.id, pharmacy.sellers[0].id)
    return response
  } catch (e) {
    console.error('[POST /api/pharmacy]', e)
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') {
      return NextResponse.json({ error: 'Un compte utilise déjà cette adresse e-mail' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Erreur lors de la création de la pharmacie' }, { status: 500 })
  }
}

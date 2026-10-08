import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { todayStr, timeStr } from '@/lib/format'

/**
 * GET /api/pharmacy  -> list all configured pharmacies
 * POST /api/pharmacy  -> create pharmacy + sellers (onboarding)
 *
 * Body for POST:
 *  { name, phone?, address?, latitude?, longitude?, sellerName, secondSellerName? }
 */
export async function GET() {
  const pharmacies = await db.pharmacy.findMany({
    include: { sellers: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ pharmacies })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, phone, address, latitude, longitude, sellerName, secondSellerName } = body as {
      name: string
      phone?: string
      address?: string
      latitude?: number | null
      longitude?: number | null
      sellerName: string
      secondSellerName?: string
    }

    if (!name || !sellerName) {
      return NextResponse.json({ error: 'Le nom de la pharmacie et du vendeur sont requis' }, { status: 400 })
    }

    const pharmacy = await db.pharmacy.create({
      data: {
        name: name.trim(),
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

    return NextResponse.json({ pharmacy })
  } catch (e) {
    console.error('[POST /api/pharmacy]', e)
    return NextResponse.json({ error: 'Erreur lors de la création de la pharmacie' }, { status: 500 })
  }
}

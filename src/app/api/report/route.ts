import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getVendorSession } from '@/lib/vendor-auth'

/**
 * GET /api/report?sessionId=...
 * Returns the full service report for a session:
 *   pharmacy, seller, session window, sales, movements, summary.
 */
export async function GET(req: NextRequest) {
  const vendor = getVendorSession(req)
  if (!vendor) return NextResponse.json({ error: 'Connexion vendeur requise' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId requis' }, { status: 400 })

  const session = await db.serviceSession.findUnique({
    where: { id: sessionId },
    include: { pharmacy: true, seller: true },
  })
  if (!session) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
  if (session.pharmacyId !== vendor.pharmacyId) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })

  const end = session.endTime ?? new Date()
  const sales = await db.sale.findMany({
    where: {
      sellerId: session.sellerId,
      pharmacyId: session.pharmacyId,
      createdAt: { gte: session.startTime, lte: end },
    },
    include: { items: true },
    orderBy: { createdAt: 'asc' },
  })

  const movements = await db.stockMovement.findMany({
    where: {
      sellerId: session.sellerId,
      pharmacyId: session.pharmacyId,
      createdAt: { gte: session.startTime, lte: end },
    },
    include: { product: true },
    orderBy: { createdAt: 'asc' },
  })

  const activities = await db.activity.findMany({
    where: {
      sellerId: session.sellerId,
      pharmacyId: session.pharmacyId,
      createdAt: { gte: session.startTime, lte: end },
    },
    orderBy: { createdAt: 'asc' },
  })

  const revenue = sales.reduce((s, x) => s + x.total, 0)
  const itemsSold = sales.reduce((s, x) => s + x.itemCount, 0)
  const entries = movements.filter((m) => m.type === 'ENTRY')
  const exits = movements.filter((m) => m.type === 'EXIT')

  return NextResponse.json({
    pharmacy: session.pharmacy,
    seller: session.seller,
    session,
    sales,
    movements,
    activities,
    summary: {
      salesCount: sales.length,
      revenue,
      itemsSold,
      entriesCount: entries.length,
      exitsCount: exits.length,
      entriesUnits: entries.reduce((s, m) => s + m.quantity, 0),
      exitsUnits: exits.reduce((s, m) => s + Math.abs(m.quantity), 0),
      startStr: session.startStr,
      endStr: session.endStr,
      startDate: session.startTime,
      endDate: end,
    },
  })
}

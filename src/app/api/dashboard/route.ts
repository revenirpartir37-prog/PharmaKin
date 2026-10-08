import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { todayStr } from '@/lib/format'

/**
 * GET /api/dashboard?pharmacyId=...&sellerId=...
 * Returns today's summary for the dashboard:
 * - today's sales (count, total, items sold)
 * - whether the seller has an open service session
 * - low stock product count
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const pharmacyId = searchParams.get('pharmacyId')
  const sellerId = searchParams.get('sellerId')

  if (!pharmacyId) return NextResponse.json({ error: 'pharmacyId requis' }, { status: 400 })

  const pharmacy = await db.pharmacy.findUnique({ where: { id: pharmacyId } })
  if (!pharmacy) return NextResponse.json({ error: 'Pharmacie introuvable' }, { status: 404 })

  // Today's date string in our format
  const today = todayStr()

  const todaySales = await db.sale.findMany({
    where: { pharmacyId, dateStr: today },
    include: { items: true },
  })

  const revenue = todaySales.reduce((s, x) => s + x.total, 0)
  const itemsSold = todaySales.reduce((s, x) => s + x.itemCount, 0)

  let openSession: Awaited<ReturnType<typeof db.serviceSession.findFirst>> = null
  if (sellerId) {
    openSession = await db.serviceSession.findFirst({
      where: { pharmacyId, sellerId, open: true },
      orderBy: { startTime: 'desc' },
    })
  }

  const products = await db.product.findMany({ where: { pharmacyId } })
  const lowStock = products.filter(
    (p) => p.minThreshold != null && p.quantity <= (p.minThreshold as number),
  ).length

  // Seller-specific today's metrics (if sellerId provided)
  let sellerToday: { salesCount: number; revenue: number; itemsSold: number } | null = null
  if (sellerId) {
    const sellerSales = todaySales.filter((s) => s.sellerId === sellerId)
    sellerToday = {
      salesCount: sellerSales.length,
      revenue: sellerSales.reduce((s, x) => s + x.total, 0),
      itemsSold: sellerSales.reduce((s, x) => s + x.itemCount, 0),
    }
  }

  return NextResponse.json({
    pharmacy,
    today: {
      date: today,
      salesCount: todaySales.length,
      revenue,
      itemsSold,
      lowStock,
      seller: sellerToday,
    },
    openSession,
  })
}

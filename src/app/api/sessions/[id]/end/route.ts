import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getVendorSession } from '@/lib/vendor-auth'
import { todayStr, timeStr } from '@/lib/format'

/**
 * POST /api/sessions/[id]/end
 * Ends a service session + creates a SERVICE_END activity.
 * Returns the closed session + a service summary (sales, revenue, products,
 * entries, exits) for the session window.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const vendor = getVendorSession(req)
  if (!vendor) return NextResponse.json({ error: 'Connexion vendeur requise' }, { status: 401 })
  const session = await db.serviceSession.findUnique({ where: { id } })
  if (!session) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
  if (session.pharmacyId !== vendor.pharmacyId) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
  if (!session.open) return NextResponse.json({ error: 'Session déjà terminée' }, { status: 400 })

  const now = new Date()
  const updated = await db.serviceSession.update({
    where: { id },
    data: {
      open: false,
      endTime: now,
      endStr: timeStr(now),
    },
  })

  const activity = await db.activity.create({
    data: {
      pharmacyId: session.pharmacyId,
      sellerId: session.sellerId,
      type: 'SERVICE_END',
      description: 'Fin du service',
      dateStr: todayStr(now),
      timeStr: timeStr(now),
      refId: session.id,
    },
  })

  // Summary of this session window
  const sales = await db.sale.findMany({
    where: {
      sellerId: session.sellerId,
      pharmacyId: session.pharmacyId,
      createdAt: { gte: session.startTime, lte: now },
    },
    include: { items: true },
  })
  const movements = await db.stockMovement.findMany({
    where: {
      sellerId: session.sellerId,
      pharmacyId: session.pharmacyId,
      createdAt: { gte: session.startTime, lte: now },
    },
  })

  const revenue = sales.reduce((s, x) => s + x.total, 0)
  const itemsSold = sales.reduce((s, x) => s + x.itemCount, 0)
  const entries = movements.filter((m) => m.type === 'ENTRY').length
  const exits = movements.filter((m) => m.type === 'EXIT').length

  return NextResponse.json({
    session: updated,
    activity,
    summary: {
      salesCount: sales.length,
      revenue,
      itemsSold,
      entries,
      exits,
      sales: sales.map((s) => ({
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        total: s.total,
        itemCount: s.itemCount,
        clientName: s.clientName,
        timeStr: s.timeStr,
        items: s.items,
      })),
      movements: movements.map((m) => ({
        id: m.id,
        type: m.type,
        quantity: m.quantity,
        reason: m.reason,
        timeStr: m.timeStr,
        productId: m.productId,
      })),
    },
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { todayStr, timeStr } from '@/lib/format'

/**
 * POST /api/stock/exit
 * Body: { pharmacyId, productId, sellerId, quantity, reason? }
 * Decreases product.quantity and records an EXIT movement + activity.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { pharmacyId, productId, sellerId, quantity, reason } = body as {
      pharmacyId: string
      productId: string
      sellerId?: string | null
      quantity: number
      reason?: string
    }

    if (!pharmacyId || !productId || !quantity || Number(quantity) <= 0) {
      return NextResponse.json({ error: 'Quantité invalide' }, { status: 400 })
    }

    const qty = Math.floor(Number(quantity))
    const now = new Date()

    const product = await db.product.findUnique({ where: { id: productId } })
    if (!product) return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 })

    if (qty > product.quantity) {
      return NextResponse.json(
        { error: `Stock insuffisant. Disponible: ${product.quantity}` },
        { status: 400 },
      )
    }

    const oldQty = product.quantity
    const newQty = oldQty - qty

    const updated = await db.product.update({
      where: { id: productId },
      data: { quantity: newQty },
    })

    const movement = await db.stockMovement.create({
      data: {
        pharmacyId,
        productId,
        sellerId: sellerId || null,
        type: 'EXIT',
        quantity: -qty,
        reason: reason || 'Sortie de stock',
        oldQuantity: oldQty,
        newQuantity: newQty,
        dateStr: todayStr(now),
        timeStr: timeStr(now),
      },
    })

    let activity = null
    if (sellerId) {
      activity = await db.activity.create({
        data: {
          pharmacyId,
          sellerId,
          type: 'STOCK_EXIT',
          description: `Sortie stock — ${product.name} -${qty}`,
          dateStr: todayStr(now),
          timeStr: timeStr(now),
          refId: movement.id,
        },
      })
    }

    return NextResponse.json({ product: updated, movement, activity })
  } catch (e) {
    console.error('[POST /api/stock/exit]', e)
    return NextResponse.json({ error: 'Erreur lors de la sortie de stock' }, { status: 500 })
  }
}

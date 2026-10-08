import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { todayStr, timeStr } from '@/lib/format'

/**
 * POST /api/stock/entry
 * Body: { pharmacyId, productId, sellerId, quantity }
 * Increases product.quantity and records an ENTRY movement + activity.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { pharmacyId, productId, sellerId, quantity } = body as {
      pharmacyId: string
      productId: string
      sellerId?: string | null
      quantity: number
    }

    if (!pharmacyId || !productId || !quantity || Number(quantity) <= 0) {
      return NextResponse.json({ error: 'Quantité invalide' }, { status: 400 })
    }

    const qty = Math.floor(Number(quantity))
    const now = new Date()

    const product = await db.product.findUnique({ where: { id: productId } })
    if (!product) return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 })

    const oldQty = product.quantity
    const newQty = oldQty + qty

    const updated = await db.product.update({
      where: { id: productId },
      data: { quantity: newQty },
    })

    const movement = await db.stockMovement.create({
      data: {
        pharmacyId,
        productId,
        sellerId: sellerId || null,
        type: 'ENTRY',
        quantity: qty,
        reason: 'Entrée de stock',
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
          type: 'STOCK_ENTRY',
          description: `Entrée stock — ${product.name} +${qty}`,
          dateStr: todayStr(now),
          timeStr: timeStr(now),
          refId: movement.id,
        },
      })
    }

    return NextResponse.json({ product: updated, movement, activity })
  } catch (e) {
    console.error('[POST /api/stock/entry]', e)
    return NextResponse.json({ error: 'Erreur lors de l\'entrée de stock' }, { status: 500 })
  }
}

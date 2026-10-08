import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { todayStr, timeStr, formatInvoiceNumber } from '@/lib/format'

/**
 * GET /api/sales?pharmacyId=...&sellerId=...&q=...
 * POST /api/sales  -> create a sale (checkout)
 *
 * Body for POST:
 *  {
 *    pharmacyId, sellerId,
 *    items: [{ productId, name, quantity, unitPrice }],
 *    clientName?: string
 *  }
 *
 * - Atomically: increments pharmacy.invoiceSeq, creates Sale + SaleItems,
 *   decrements product.quantity for each item, creates SALE StockMovements
 *   and a SALE Activity log. Returns the full sale (with items) so the
 *   client can render the invoice immediately.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const pharmacyId = searchParams.get('pharmacyId') || undefined
  const sellerId = searchParams.get('sellerId') || undefined
  const q = searchParams.get('q') || ''

  const sales = await db.sale.findMany({
    where: {
      ...(pharmacyId ? { pharmacyId } : {}),
      ...(sellerId ? { sellerId } : {}),
      ...(q
        ? {
            OR: [
              { invoiceNumber: { contains: q } },
              { clientName: { contains: q } },
            ],
          }
        : {}),
    },
    include: { items: true, seller: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ sales })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { pharmacyId, sellerId, items, clientName } = body as {
      pharmacyId: string
      sellerId: string
      items: { productId: string; name: string; quantity: number; unitPrice: number }[]
      clientName?: string
    }

    if (!pharmacyId || !sellerId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Données de vente invalides' }, { status: 400 })
    }

    const now = new Date()
    const dStr = todayStr(now)
    const tStr = timeStr(now)

    // 1) Verify stock for all items + snapshot
    const productIds = items.map((i) => i.productId)
    const products = await db.product.findMany({ where: { id: { in: productIds } } })
    const productMap = new Map(products.map((p) => [p.id, p]))

    for (const it of items) {
      const p = productMap.get(it.productId)
      if (!p) return NextResponse.json({ error: `Produit introuvable: ${it.name}` }, { status: 400 })
      if (it.quantity <= 0) return NextResponse.json({ error: 'Quantité invalide' }, { status: 400 })
      if (it.quantity > p.quantity) {
        return NextResponse.json(
          { error: `Stock insuffissant pour ${p.name}. Disponible: ${p.quantity}` },
          { status: 400 },
        )
      }
    }

    const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
    const itemCount = items.reduce((s, i) => s + i.quantity, 0)

    // 2) Increment invoice sequence atomically
    const pharmacy = await db.pharmacy.update({
      where: { id: pharmacyId },
      data: { invoiceSeq: { increment: 1 } },
    })
    const invoiceNumber = formatInvoiceNumber(pharmacy.invoiceSeq)

    // 3) Create the sale + items
    const sale = await db.sale.create({
      data: {
        pharmacyId,
        sellerId,
        invoiceNumber,
        clientName: clientName?.trim() || null,
        total,
        itemCount,
        dateStr: dStr,
        timeStr: tStr,
        items: {
          create: items.map((i) => ({
            productId: i.productId,
            name: i.name,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            lineTotal: i.quantity * i.unitPrice,
          })),
        },
      },
      include: { items: true },
    })

    // 4) Decrement stock + create SALE movements
    for (const it of items) {
      const p = productMap.get(it.productId)!
      const oldQty = p.quantity
      const newQty = oldQty - it.quantity

      await db.product.update({
        where: { id: it.productId },
        data: { quantity: newQty },
      })

      await db.stockMovement.create({
        data: {
          pharmacyId,
          productId: it.productId,
          sellerId,
          type: 'SALE',
          quantity: -it.quantity,
          reason: `Vente ${invoiceNumber}`,
          oldQuantity: oldQty,
          newQuantity: newQty,
          dateStr: dStr,
          timeStr: tStr,
        },
      })
    }

    // 5) Activity log
    const itemsDesc = items.map((i) => `${i.name} ×${i.quantity}`).join(', ')
    const activity = await db.activity.create({
      data: {
        pharmacyId,
        sellerId,
        type: 'SALE',
        description: `Vente — ${itemsDesc}`,
        dateStr: dStr,
        timeStr: tStr,
        refId: sale.id,
      },
    })

    return NextResponse.json({ sale, activity, pharmacy })
  } catch (e) {
    console.error('[POST /api/sales]', e)
    return NextResponse.json({ error: 'Erreur lors de la création de la vente' }, { status: 500 })
  }
}

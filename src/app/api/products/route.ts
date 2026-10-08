import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { todayStr, timeStr } from '@/lib/format'

/**
 * GET /api/products?pharmacyId=...&q=...&low=1
 * POST /api/products  -> add product (and optionally record initial stock as ENTRY movement)
 *
 * Body for POST:
 *  { pharmacyId, name, category?, price, quantity, minThreshold?, expiryDate?, barcode? }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const pharmacyId = searchParams.get('pharmacyId') || undefined
  const q = searchParams.get('q') || ''
  const low = searchParams.get('low') === '1'

  const products = await db.product.findMany({
    where: {
      ...(pharmacyId ? { pharmacyId } : {}),
      ...(q ? { name: { contains: q } } : {}),
    },
    orderBy: { name: 'asc' },
  })

  let list = products
  if (low) {
    list = products.filter((p) => (p.minThreshold != null ? p.quantity <= p.minThreshold : false))
  }

  return NextResponse.json({ products: list })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      pharmacyId,
      sellerId,
      name,
      category,
      price,
      quantity,
      minThreshold,
      expiryDate,
      barcode,
    } = body as {
      pharmacyId: string
      sellerId?: string | null
      name: string
      category?: string
      price: number
      quantity: number
      minThreshold?: number | null
      expiryDate?: string | null
      barcode?: string | null
    }

    if (!pharmacyId || !name || price == null || quantity == null) {
      return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
    }

    const product = await db.product.create({
      data: {
        pharmacyId,
        name: name.trim(),
        category: category?.trim() || null,
        price: Number(price),
        quantity: Number(quantity),
        minThreshold: minThreshold != null ? Number(minThreshold) : null,
        expiryDate: expiryDate || null,
        barcode: barcode || null,
      },
    })

    // Record an initial ENTRY movement + activity
    if (Number(quantity) > 0) {
      const now = new Date()
      await db.stockMovement.create({
        data: {
          pharmacyId,
          productId: product.id,
          sellerId: sellerId || null,
          type: 'ENTRY',
          quantity: Number(quantity),
          reason: 'Création produit',
          oldQuantity: 0,
          newQuantity: Number(quantity),
          dateStr: todayStr(now),
          timeStr: timeStr(now),
        },
      })
      if (sellerId) {
        await db.activity.create({
          data: {
            pharmacyId,
            sellerId,
            type: 'PRODUCT_ADD',
            description: `Produit ajouté — ${product.name} (qté initiale ${quantity})`,
            dateStr: todayStr(now),
            timeStr: timeStr(now),
          },
        })
      }
    }

    return NextResponse.json({ product })
  } catch (e) {
    console.error('[POST /api/products]', e)
    return NextResponse.json({ error: 'Erreur lors de l\'ajout du produit' }, { status: 500 })
  }
}

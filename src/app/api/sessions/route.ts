import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { todayStr, timeStr } from '@/lib/format'

/**
 * POST /api/sessions
 * Body: { pharmacyId, sellerId }
 * - Closes any open session for this pharmacy/seller (safety).
 * - Creates a new open session and a SERVICE_START activity.
 * Returns the new session.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { pharmacyId, sellerId } = body as { pharmacyId: string; sellerId: string }
    if (!pharmacyId || !sellerId) {
      return NextResponse.json({ error: 'pharmacyId et sellerId requis' }, { status: 400 })
    }

    const now = new Date()

    // Close any currently-open session for this seller in this pharmacy
    await db.serviceSession.updateMany({
      where: { pharmacyId, sellerId, open: true },
      data: {
        open: false,
        endTime: now,
        endStr: timeStr(now),
      },
    })

    const session = await db.serviceSession.create({
      data: {
        pharmacyId,
        sellerId,
        startTime: now,
        startStr: timeStr(now),
        open: true,
      },
    })

    const activity = await db.activity.create({
      data: {
        pharmacyId,
        sellerId,
        type: 'SERVICE_START',
        description: 'Début du service',
        dateStr: todayStr(now),
        timeStr: timeStr(now),
        refId: session.id,
      },
    })

    return NextResponse.json({ session, activity })
  } catch (e) {
    console.error('[POST /api/sessions]', e)
    return NextResponse.json({ error: 'Erreur lors du démarrage du service' }, { status: 500 })
  }
}

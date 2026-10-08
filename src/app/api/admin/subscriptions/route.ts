import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminRequest } from '@/lib/admin-auth'
import { SUBSCRIPTION_DURATION_DAYS } from '@/lib/subscription'
import { hashPassword } from '@/lib/vendor-auth'
import { randomBytes } from 'node:crypto'

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: 'Accès administrateur requis' }, { status: 401 })
  }

  try {
    const now = new Date()
    const [requests, pharmacies, subscriptions, revenueByPharmacy, totalRevenue, pendingCount] = await Promise.all([
      db.subscription.findMany({
        where: { status: 'pending_review' },
        orderBy: { updatedAt: 'asc' },
        take: 100,
        select: {
          id: true,
          pharmacyId: true,
          amount: true,
          currency: true,
          createdAt: true,
          updatedAt: true,
          screenshotData: true,
          pharmacy: { select: { name: true, phone: true, address: true } },
        },
      }),
      db.pharmacy.findMany({
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, email: true, phone: true, suspended: true, createdAt: true },
      }),
      db.subscription.findMany({
        where: { status: { in: ['active', 'pending_review', 'rejected', 'expired'] } },
        orderBy: { updatedAt: 'desc' },
        select: {
          pharmacyId: true,
          status: true,
          endDate: true,
          updatedAt: true,
        },
      }),
      db.subscription.groupBy({
        by: ['pharmacyId'],
        where: { paymentMethod: 'manual_mpesa', status: { in: ['active', 'expired'] } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      db.subscription.aggregate({
        where: { paymentMethod: 'manual_mpesa', status: { in: ['active', 'expired'] } },
        _sum: { amount: true },
      }),
      db.subscription.count({ where: { status: 'pending_review' } }),
    ])

    const revenue = new Map(
      revenueByPharmacy.map((entry) => [
        entry.pharmacyId,
        { amount: entry._sum.amount ?? 0, payments: entry._count._all },
      ]),
    )
    const latestSubscription = new Map<string, (typeof subscriptions)[number]>()
    for (const subscription of subscriptions) {
      if (!latestSubscription.has(subscription.pharmacyId)) {
        latestSubscription.set(subscription.pharmacyId, subscription)
      }
    }

    const pharmaciesWithStatus = pharmacies.map((pharmacy) => {
      const active = subscriptions.find(
        (subscription) =>
          subscription.pharmacyId === pharmacy.id &&
          subscription.status === 'active' &&
          subscription.endDate !== null &&
          subscription.endDate > now,
      )
      const pending = subscriptions.some(
        (subscription) =>
          subscription.pharmacyId === pharmacy.id &&
          subscription.status === 'pending_review',
      )
      const latest = latestSubscription.get(pharmacy.id)
      const daysRemaining = active?.endDate
        ? Math.max(0, Math.ceil((active.endDate.getTime() - now.getTime()) / 86_400_000))
        : 0
      const subscriptionStatus = pharmacy.suspended
        ? 'suspended'
        : active
        ? 'active'
        : pending
          ? 'pending_review'
          : latest?.status === 'rejected'
            ? 'rejected'
            : latest
              ? 'expired'
              : 'unpaid'

      return {
        ...pharmacy,
        revenue: revenue.get(pharmacy.id)?.amount ?? 0,
        approvedPayments: revenue.get(pharmacy.id)?.payments ?? 0,
        subscriptionStatus,
        daysRemaining,
        endDate: active?.endDate ?? latest?.endDate ?? null,
      }
    })

    return NextResponse.json({
      requests,
      pharmacies: pharmaciesWithStatus,
      totalRevenue: totalRevenue._sum.amount ?? 0,
      pendingCount,
      activeCount: pharmaciesWithStatus.filter((pharmacy) => pharmacy.subscriptionStatus === 'active').length,
      unpaidCount: pharmaciesWithStatus.filter((pharmacy) => ['unpaid', 'expired', 'rejected'].includes(pharmacy.subscriptionStatus)).length,
      expiringSoonCount: pharmaciesWithStatus.filter(
        (pharmacy) => pharmacy.subscriptionStatus === 'active' && pharmacy.daysRemaining <= 3,
      ).length,
    })
  } catch (error) {
    console.error('[GET /api/admin/subscriptions]', error)
    return NextResponse.json({ error: 'Impossible de charger les données administrateur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: 'Accès administrateur requis' }, { status: 401 })
  }

  try {
    const body = await request.json()
    if (['delete', 'suspend', 'unsuspend', 'cancel', 'renew', 'reset-password'].includes(body.action)) {
      if (typeof body.pharmacyId !== 'string' || !body.pharmacyId) {
        return NextResponse.json({ error: 'Pharmacie requise' }, { status: 400 })
      }
      const pharmacy = await db.pharmacy.findUnique({
        where: { id: body.pharmacyId },
        select: { id: true, email: true, suspended: true },
      })
      if (!pharmacy) return NextResponse.json({ error: 'Pharmacie introuvable' }, { status: 404 })

      if (body.action === 'delete') {
        await db.pharmacy.delete({ where: { id: pharmacy.id } })
        return NextResponse.json({ deleted: true })
      }
      if (body.action === 'suspend' || body.action === 'unsuspend') {
        const suspended = body.action === 'suspend'
        await db.pharmacy.update({ where: { id: pharmacy.id }, data: { suspended } })
        return NextResponse.json({ suspended })
      }
      if (body.action === 'cancel') {
        await db.subscription.updateMany({
          where: { pharmacyId: pharmacy.id, status: 'active' },
          data: { status: 'cancelled', endDate: new Date() },
        })
        return NextResponse.json({ cancelled: true })
      }
      if (body.action === 'renew') {
        const now = new Date()
        const current = await db.subscription.findFirst({
          where: { pharmacyId: pharmacy.id, status: 'active', endDate: { gt: now } },
          orderBy: { endDate: 'desc' },
        })
        const startDate = current?.endDate ?? now
        const endDate = new Date(startDate.getTime() + SUBSCRIPTION_DURATION_DAYS * 86_400_000)
        const subscription = await db.subscription.create({
          data: {
            pharmacyId: pharmacy.id,
            status: 'active',
            amount: 0,
            durationDays: SUBSCRIPTION_DURATION_DAYS,
            startDate,
            endDate,
            paymentMethod: 'admin_grant',
            note: 'Renouvellement manuel accordé par l’administration',
          },
        })
        return NextResponse.json({ renewed: true, subscription })
      }
      const temporaryPassword = randomBytes(12).toString('base64url')
      let emailUpdate: string | undefined
      if (body.email !== undefined) {
        if (typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
          return NextResponse.json({ error: 'Adresse e-mail invalide' }, { status: 400 })
        }
        emailUpdate = body.email.trim().toLowerCase()
        const existingEmail = await db.pharmacy.findUnique({ where: { email: emailUpdate }, select: { id: true } })
        if (existingEmail && existingEmail.id !== pharmacy.id) {
          return NextResponse.json({ error: 'Cette adresse e-mail est déjà utilisée' }, { status: 409 })
        }
      }
      await db.pharmacy.update({
        where: { id: pharmacy.id },
        data: { passwordHash: await hashPassword(temporaryPassword), ...(emailUpdate ? { email: emailUpdate } : {}) },
      })
      return NextResponse.json({ temporaryPassword, email: emailUpdate ?? pharmacy.email })
    }

    if (body.action === 'grant') {
      if (
        typeof body.sendToAll !== 'boolean' ||
        (!body.sendToAll &&
          (!Array.isArray(body.pharmacyIds) ||
            body.pharmacyIds.length < 1 ||
            body.pharmacyIds.length > 100 ||
            body.pharmacyIds.some((id: unknown) => typeof id !== 'string'))) ||
        !Number.isInteger(body.weeks) ||
        body.weeks < 1 ||
        body.weeks > 52
      ) {
        return NextResponse.json({ error: 'Choisissez une à 100 pharmacies et de 1 à 52 semaines' }, { status: 400 })
      }

      const pharmacies = body.sendToAll
        ? await db.pharmacy.findMany({ select: { id: true } })
        : await db.pharmacy.findMany({
            where: { id: { in: [...new Set(body.pharmacyIds as string[])] } },
            select: { id: true },
          })
      if (!body.sendToAll && pharmacies.length !== new Set(body.pharmacyIds as string[]).size) {
        return NextResponse.json({ error: 'Une ou plusieurs pharmacies sont introuvables' }, { status: 404 })
      }
      if (pharmacies.length === 0) {
        return NextResponse.json({ error: 'Aucune pharmacie à sélectionner' }, { status: 400 })
      }

      const now = new Date()
      const grants = await db.$transaction(async (transaction) => {
        const created: { id: string; pharmacyId: string; endDate: Date | null }[] = []
        for (const pharmacy of pharmacies) {
          const latestActive = await transaction.subscription.findFirst({
            where: { pharmacyId: pharmacy.id, status: 'active', endDate: { gt: now } },
            orderBy: { endDate: 'desc' },
          })
          const startDate = latestActive?.endDate ?? now
          created.push(
            await transaction.subscription.create({
              data: {
                pharmacyId: pharmacy.id,
                status: 'active',
                amount: 0,
                durationDays: body.weeks * 7,
                startDate,
                endDate: new Date(startDate.getTime() + body.weeks * 7 * 86_400_000),
                paymentMethod: 'admin_grant',
                note: `Période offerte par l’administration : ${body.weeks} semaine(s)`,
              },
              select: { id: true, pharmacyId: true, endDate: true },
            }),
          )
        }
        return created
      })

      return NextResponse.json({ granted: grants.length, grants })
    }

    const { subscriptionId, decision, message } = body as {
      subscriptionId?: string
      decision?: string
      message?: string
    }
    if (!subscriptionId || !['approve', 'reject'].includes(decision ?? '')) {
      return NextResponse.json({ error: 'Demande et décision requises' }, { status: 400 })
    }
    const rejectionMessage = typeof message === 'string' ? message.trim() : ''
    if (decision === 'reject' && !rejectionMessage) {
      return NextResponse.json({ error: 'Indiquez le motif du refus' }, { status: 400 })
    }

    const subscription = await db.subscription.findUnique({ where: { id: subscriptionId } })
    if (!subscription || subscription.status !== 'pending_review') {
      return NextResponse.json({ error: 'Cette demande n’est plus en attente' }, { status: 409 })
    }

    if (decision === 'reject') {
      await db.subscription.update({
        where: { id: subscriptionId },
        data: { status: 'rejected', reviewMessage: rejectionMessage },
      })
      return NextResponse.json({ reviewed: true, decision })
    }

    const now = new Date()
    const latestActive = await db.subscription.findFirst({
      where: {
        pharmacyId: subscription.pharmacyId,
        status: 'active',
        endDate: { gt: now },
      },
      orderBy: { endDate: 'desc' },
    })
    const startDate =
      latestActive?.endDate && latestActive.endDate > now ? latestActive.endDate : now
    const endDate = new Date(
      startDate.getTime() + SUBSCRIPTION_DURATION_DAYS * 24 * 60 * 60 * 1000,
    )

    const approved = await db.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'active',
        startDate,
        endDate,
        durationDays: SUBSCRIPTION_DURATION_DAYS,
        reviewMessage: null,
        note: 'Paiement M-Pesa validé par l’administration',
      },
    })

    return NextResponse.json({ reviewed: true, decision, subscription: approved })
  } catch (error) {
    console.error('[POST /api/admin/subscriptions]', error)
    return NextResponse.json({ error: 'Impossible de traiter la demande' }, { status: 500 })
  }
}

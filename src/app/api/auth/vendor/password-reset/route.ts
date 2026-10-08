import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/vendor-auth'

const CODE_LIFETIME_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 5

function hashCode(email: string, code: string) {
  const secret = process.env.PHARMAKIN_PASSWORD_RESET_SECRET ||
    process.env.PHARMAKIN_VENDOR_SESSION_SECRET ||
    process.env.PHARMAKIN_ADMIN_SESSION_SECRET
  if (!secret) throw new Error('PHARMAKIN_PASSWORD_RESET_SECRET is not configured')
  return createHmac('sha256', secret).update(`${email}:${code}`).digest()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (body.action === 'request') {
      if (typeof body.email !== 'string' || body.email.length > 254) {
        return NextResponse.json({ error: 'Adresse e-mail requise' }, { status: 400 })
      }
      const email = body.email.trim().toLowerCase()
      const apiKey = process.env.RESEND_API_KEY
      const from = process.env.PHARMAKIN_EMAIL_FROM
      if (!apiKey || !from) {
        console.error('[password-reset] Email delivery is not configured (RESEND_API_KEY/PHARMAKIN_EMAIL_FROM)')
        return NextResponse.json({ error: 'Envoi d’e-mail non configuré. Contactez l’administrateur.' }, { status: 503 })
      }
      const pharmacy = await db.pharmacy.findUnique({ where: { email }, select: { id: true } })
      if (pharmacy) {
        const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
        await db.pharmacyPasswordReset.create({
          data: {
            pharmacyId: pharmacy.id,
            codeHash: hashCode(email, code).toString('base64url'),
            expiresAt: new Date(Date.now() + CODE_LIFETIME_MS),
          },
        })
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from,
            to: [email],
            subject: 'Code de réinitialisation PharmaKin',
            text: `Votre code de réinitialisation PharmaKin est ${code}. Il expire dans 10 minutes. Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.`,
          }),
        })
        if (!emailResponse.ok) {
          console.error('[password-reset] Email provider rejected request:', emailResponse.status, await emailResponse.text())
          return NextResponse.json({ error: 'Impossible d’envoyer le code par e-mail pour le moment' }, { status: 502 })
        }
      }
      return NextResponse.json({ message: 'Si cette adresse correspond à un compte, un code lui a été envoyé.' })
    }

    if (body.action === 'reset') {
      if (
        typeof body.email !== 'string' ||
        typeof body.code !== 'string' ||
        !/^\d{6}$/.test(body.code) ||
        typeof body.password !== 'string' ||
        body.password.length < 10 ||
        body.password.length > 128
      ) {
        return NextResponse.json({ error: 'E-mail, code à 6 chiffres et nouveau mot de passe (10 caractères minimum) requis' }, { status: 400 })
      }
      const email = body.email.trim().toLowerCase()
      const pharmacy = await db.pharmacy.findUnique({ where: { email }, select: { id: true } })
      if (!pharmacy) return NextResponse.json({ error: 'Code invalide ou expiré' }, { status: 400 })
      const reset = await db.pharmacyPasswordReset.findFirst({
        where: { pharmacyId: pharmacy.id, usedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: MAX_ATTEMPTS } },
        orderBy: { createdAt: 'desc' },
      })
      if (!reset) return NextResponse.json({ error: 'Code invalide ou expiré' }, { status: 400 })
      const expected = Buffer.from(reset.codeHash, 'base64url')
      const actual = hashCode(email, body.code)
      const correct = expected.length === actual.length && timingSafeEqual(expected, actual)
      if (!correct) {
        await db.pharmacyPasswordReset.update({ where: { id: reset.id }, data: { attempts: { increment: 1 } } })
        return NextResponse.json({ error: 'Code invalide ou expiré' }, { status: 400 })
      }
      await db.$transaction([
        db.pharmacy.update({ where: { id: pharmacy.id }, data: { passwordHash: await hashPassword(body.password) } }),
        db.pharmacyPasswordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
      ])
      const response = NextResponse.json({ reset: true })
      response.cookies.set('pharmakin-vendor-session', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 0 })
      return response
    }
    return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
  } catch (error) {
    console.error('[POST /api/auth/vendor/password-reset]', error)
    return NextResponse.json({ error: 'Réinitialisation temporairement indisponible' }, { status: 500 })
  }
}

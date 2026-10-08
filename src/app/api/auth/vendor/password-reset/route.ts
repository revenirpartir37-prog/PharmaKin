import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (body.action === 'request') {
      if (typeof body.email !== 'string' || body.email.length > 254) {
        return NextResponse.json({ error: 'Adresse e-mail requise' }, { status: 400 })
      }
      return NextResponse.json({
        message: 'Pour protéger votre compte, contactez l’administrateur PharmaKin. Il peut générer un mot de passe temporaire et vous le transmettre à votre adresse e-mail.',
      })
    }
    return NextResponse.json({ error: 'La réinitialisation en libre-service n’est pas activée. Demandez un mot de passe temporaire à l’administrateur.' }, { status: 403 })
  } catch (error) {
    console.error('[POST /api/auth/vendor/password-reset]', error)
    return NextResponse.json({ error: 'Réinitialisation temporairement indisponible' }, { status: 500 })
  }
}

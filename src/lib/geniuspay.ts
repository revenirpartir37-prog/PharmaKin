import 'server-only'

/**
 * GeniusPay server-side client.
 * Docs: https://geniuspay.ci/docs/api
 *
 * Initiate a payment -> returns a checkout_url (hosted page) OR a
 * payment_url (direct gateway). Customer pays there via Mobile Money /
 * Wave / Orange / MTN / Moov / Card, then GeniusPay redirects to
 * success_url / error_url and sends a webhook.
 */

const API_URL = process.env.GENIUSPAY_API_URL || 'https://geniuspay.ci/api/v1/merchant'
const API_KEY = process.env.GENIUSPAY_API_KEY || ''
const API_SECRET = process.env.GENIUSPAY_API_SECRET || ''

export const SUBSCRIPTION_PRICE = Number(process.env.PHARMAKIN_SUBSCRIPTION_PRICE || 5000)
export const SUBSCRIPTION_DURATION_DAYS = Number(
  process.env.PHARMAKIN_SUBSCRIPTION_DURATION_DAYS || 7,
)
export const SUBSCRIPTION_CURRENCY = process.env.PHARMAKIN_CURRENCY || 'CDF'
export const RECHARGE_CODE = process.env.PHARMAKIN_RECHARGE_CODE?.trim() || ''

function headers() {
  return {
    'X-API-Key': API_KEY,
    'X-API-Secret': API_SECRET,
    'Content-Type': 'application/json',
  }
}

export interface InitiatePaymentInput {
  amount: number
  description: string
  customer: {
    name?: string
    email?: string
    phone?: string
    country?: string // ISO2 ex: CD
  }
  successUrl: string
  errorUrl: string
  metadata?: Record<string, string>
}

export interface InitiatePaymentResult {
  success: boolean
  reference?: string
  checkoutUrl?: string
  paymentUrl?: string
  raw?: unknown
  error?: string
}

/**
 * POST /payments — initiate a GeniusPay payment.
 * We don't specify payment_method so GeniusPay returns a hosted checkout_url
 * where the customer picks their preferred Mobile Money provider.
 *
 * Currency: we send the configured currency (default CDF). If GeniusPay
 * rejects it (only XOF/EUR/USD are documented), we retry without currency
 * (defaults to XOF). The PharmaKin UI always shows "CDF" regardless.
 */
export async function initiatePayment(
  input: InitiatePaymentInput,
): Promise<InitiatePaymentResult> {
  if (!API_KEY || !API_SECRET) {
    return { success: false, error: 'Clés GeniusPay non configurées (.env)' }
  }

  const baseBody = {
    amount: input.amount,
    description: input.description,
    customer: input.customer,
    success_url: input.successUrl,
    error_url: input.errorUrl,
    metadata: input.metadata ?? {},
  }

  // Try with configured currency first
  const attempts = [
    { ...baseBody, currency: SUBSCRIPTION_CURRENCY },
    { ...baseBody }, // omit currency (defaults to XOF on GeniusPay side)
  ]

  for (const body of attempts) {
    try {
      const res = await fetch(`${API_URL}/payments`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
      })
      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; data?: { reference?: string; checkout_url?: string; payment_url?: string }; message?: string; error?: string }
        | null

      if (res.ok && json?.success && json.data) {
        return {
          success: true,
          reference: json.data.reference,
          checkoutUrl: json.data.checkout_url,
          paymentUrl: json.data.payment_url,
          raw: json,
        }
      }

      // If first attempt failed because of currency, try the next attempt
      const errMsg =
        json?.message || json?.error || `HTTP ${res.status}`
      // Only retry if this was the currency attempt and the next attempt is different
      if (body === attempts[0] && attempts.length > 1) {
        // log and try the fallback
        console.warn('[geniuspay] retry without currency:', errMsg)
        continue
      }
      return { success: false, error: errMsg }
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Erreur réseau GeniusPay',
      }
    }
  }

  return { success: false, error: 'Échec inattendu' }
}

export interface PaymentStatusResult {
  success: boolean
  status?: 'pending' | 'completed' | 'failed' | string
  amount?: number
  currency?: string
  paymentMethod?: string
  paidAt?: string
  raw?: unknown
  error?: string
}

/**
 * GET /payments/{reference} — verify a payment status.
 */
export async function getPaymentStatus(
  reference: string,
): Promise<PaymentStatusResult> {
  if (!API_KEY || !API_SECRET) {
    return { success: false, error: 'Clés GeniusPay non configurées' }
  }
  try {
    const res = await fetch(`${API_URL}/payments/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: headers(),
    })
    const json = (await res.json().catch(() => null)) as
      | { success?: boolean; data?: { status?: string; amount?: number; currency?: string; payment_method?: string; completed_at?: string }; message?: string; error?: string }
      | null

    if (res.ok && json?.success && json.data) {
      return {
        success: true,
        status: json.data.status,
        amount: json.data.amount,
        currency: json.data.currency,
        paymentMethod: json.data.payment_method,
        paidAt: json.data.completed_at,
        raw: json,
      }
    }
    return {
      success: false,
      error: json?.message || json?.error || `HTTP ${res.status}`,
    }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Erreur réseau GeniusPay',
    }
  }
}

/**
 * Compute the absolute base URL of the app for building success/error URLs.
 * Uses APP_BASE_URL if set, otherwise derives from the request Origin header.
 */
export function appBaseUrl(requestOrigin?: string | null): string {
  const env = process.env.APP_BASE_URL
  if (env && env.trim().length > 0) return env.replace(/\/$/, '')
  if (requestOrigin) return requestOrigin.replace(/\/$/, '')
  return 'http://localhost:3000'
}

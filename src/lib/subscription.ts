import 'server-only'

export const SUBSCRIPTION_PRICE = Number(process.env.PHARMAKIN_SUBSCRIPTION_PRICE || 5000)
export const SUBSCRIPTION_DURATION_DAYS = Number(
  process.env.PHARMAKIN_SUBSCRIPTION_DURATION_DAYS || 7,
)
export const SUBSCRIPTION_CURRENCY = process.env.PHARMAKIN_CURRENCY || 'CDF'

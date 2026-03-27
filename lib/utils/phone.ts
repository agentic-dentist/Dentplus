// ─── Phone number utilities ───────────────────────────────────────────────────
// Twilio requires E.164 format: +15141234567
// Canadian/US numbers stored as: 514-977-6725 / 5149776725 / (514) 977-6725

export function toE164(phone: string | null, defaultCountry = '1'): string | null {
  if (!phone) return null

  // Strip everything except digits and leading +
  const digits = phone.replace(/\D/g, '')

  if (!digits) return null

  // Already has country code (11 digits starting with 1 for CA/US)
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }

  // 10-digit North American number
  if (digits.length === 10) {
    return `+${defaultCountry}${digits}`
  }

  // Already E.164 with + prefix
  if (phone.startsWith('+') && digits.length >= 10) {
    return `+${digits}`
  }

  // Can't reliably format — return null to avoid sending to wrong number
  console.warn(`[PHONE] Could not format to E.164: ${phone}`)
  return null
}

export function isValidCanadianPhone(phone: string | null): boolean {
  if (!phone) return false
  const e164 = toE164(phone)
  if (!e164) return false
  // Canadian numbers: +1 followed by area code not starting with 0 or 1
  return /^\+1[2-9]\d{9}$/.test(e164)
}

// Format for display: +15149776725 → (514) 977-6725
export function formatPhoneDisplay(phone: string | null): string {
  if (!phone) return '—'
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    const n = digits.slice(1)
    return `(${n.slice(0,3)}) ${n.slice(3,6)}-${n.slice(6)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
  }
  return phone
}

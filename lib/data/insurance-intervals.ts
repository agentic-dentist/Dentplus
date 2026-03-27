// ─── Canadian Dental Insurance Coverage Intervals ────────────────────────────
// These are typical coverage rules per insurer.
// Phase 2: replace with real-time Telus eClaims / CDAnet eligibility check.
//
// Intervals are in months. null = not typically covered.
// Sources: insurer benefit booklets, dental association guides.

export interface CoverageRule {
  provider:          string          // Normalized insurer name (lowercase, partial match)
  cleaning:          number          // Prophylaxis / scaling — months between covered visits
  checkup:           number          // Recall exam — months between covered visits
  xrays_bitewing:    number          // Bitewing X-rays — months
  xrays_full:        number | null   // Full mouth X-rays — months (null = not routine)
  fluoride:          number | null   // Fluoride treatment — months (often age-limited)
  notes:             string          // Human-readable caveat for messaging
}

// Ordered from most specific to most general — first match wins
export const COVERAGE_RULES: CoverageRule[] = [
  {
    provider:       'sun life',
    cleaning:       6,
    checkup:        6,
    xrays_bitewing: 12,
    xrays_full:     36,
    fluoride:       12,
    notes:          'Most Sun Life plans cover 2 cleanings per year.',
  },
  {
    provider:       'manulife',
    cleaning:       9,
    checkup:        9,
    xrays_bitewing: 12,
    xrays_full:     36,
    fluoride:       12,
    notes:          'Manulife FlexCare and GroupPlus typically allow cleanings every 9 months.',
  },
  {
    provider:       'desjardins',
    cleaning:       6,
    checkup:        6,
    xrays_bitewing: 12,
    xrays_full:     36,
    fluoride:       12,
    notes:          'Desjardins dental plans generally cover 2 cleanings per year.',
  },
  {
    provider:       'great-west',
    cleaning:       6,
    checkup:        6,
    xrays_bitewing: 12,
    xrays_full:     36,
    fluoride:       12,
    notes:          'Great-West Life (Canada Life) typically covers 2 cleanings per year.',
  },
  {
    provider:       'canada life',
    cleaning:       6,
    checkup:        6,
    xrays_bitewing: 12,
    xrays_full:     36,
    fluoride:       12,
    notes:          'Canada Life typically covers 2 cleanings per year.',
  },
  {
    provider:       'blue cross',
    cleaning:       6,
    checkup:        6,
    xrays_bitewing: 12,
    xrays_full:     36,
    fluoride:       12,
    notes:          'Blue Cross plans typically cover 2 cleanings per year.',
  },
  {
    provider:       'ssq',
    cleaning:       6,
    checkup:        6,
    xrays_bitewing: 12,
    xrays_full:     36,
    fluoride:       12,
    notes:          'SSQ plans typically cover 2 cleanings per year.',
  },
  {
    provider:       'ia financial',
    cleaning:       6,
    checkup:        6,
    xrays_bitewing: 12,
    xrays_full:     36,
    fluoride:       12,
    notes:          'iA Financial plans typically cover 2 cleanings per year.',
  },
  {
    provider:       'industrial alliance',
    cleaning:       6,
    checkup:        6,
    xrays_bitewing: 12,
    xrays_full:     36,
    fluoride:       12,
    notes:          'iA Financial plans typically cover 2 cleanings per year.',
  },
  {
    provider:       'chamber of commerce',
    cleaning:       6,
    checkup:        6,
    xrays_bitewing: 12,
    xrays_full:     36,
    fluoride:       12,
    notes:          'Chamber of Commerce plans typically cover 2 cleanings per year.',
  },
  // Quebec-specific programs
  {
    provider:       'ramq',
    cleaning:       9,
    checkup:        12,
    xrays_bitewing: 24,
    xrays_full:     null,
    fluoride:       null,
    notes:          'RAMQ dental coverage is limited — verify patient eligibility.',
  },
  // Federal / government plans
  {
    provider:       'cdcp',  // Canadian Dental Care Plan
    cleaning:       9,
    checkup:        12,
    xrays_bitewing: 12,
    xrays_full:     36,
    fluoride:       12,
    notes:          'CDCP covers eligible Canadians — income-tested, verify eligibility.',
  },
  {
    provider:       'canadian dental care plan',
    cleaning:       9,
    checkup:        12,
    xrays_bitewing: 12,
    xrays_full:     36,
    fluoride:       12,
    notes:          'CDCP covers eligible Canadians — income-tested, verify eligibility.',
  },
  // Generic fallback
  {
    provider:       'default',
    cleaning:       6,
    checkup:        6,
    xrays_bitewing: 12,
    xrays_full:     36,
    fluoride:       12,
    notes:          'Coverage varies by plan — we recommend verifying with your insurer.',
  },
]

export function getCoverageRule(providerName: string | null): CoverageRule {
  if (!providerName) return COVERAGE_RULES[COVERAGE_RULES.length - 1]
  const normalized = providerName.toLowerCase().trim()
  return (
    COVERAGE_RULES.find(r => r.provider !== 'default' && normalized.includes(r.provider)) ??
    COVERAGE_RULES[COVERAGE_RULES.length - 1]
  )
}

// Given last visit date and coverage interval, returns:
// { due: boolean, monthsOverdue: number, coverageStatus: 'covered' | 'likely_covered' | 'unknown' }
export function checkRecallEligibility(
  lastVisitDate: string | null,
  serviceType: 'cleaning' | 'checkup',
  providerName: string | null,
): {
  due: boolean
  monthsSinceVisit: number | null
  intervalMonths: number
  coverageStatus: 'covered' | 'likely_covered' | 'unknown'
  rule: CoverageRule
} {
  const rule = getCoverageRule(providerName)
  const intervalMonths = serviceType === 'cleaning' ? rule.cleaning : rule.checkup

  if (!lastVisitDate) {
    return { due: true, monthsSinceVisit: null, intervalMonths, coverageStatus: 'unknown', rule }
  }

  const last    = new Date(lastVisitDate + 'T12:00:00')
  const now     = new Date()
  const diffMs  = now.getTime() - last.getTime()
  const monthsSinceVisit = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44))

  const due     = monthsSinceVisit >= intervalMonths
  const coverageStatus =
    providerName
      ? monthsSinceVisit >= intervalMonths ? 'covered' : 'likely_covered'
      : 'unknown'

  return { due, monthsSinceVisit, intervalMonths, coverageStatus, rule }
}

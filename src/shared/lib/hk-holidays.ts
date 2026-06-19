// HK Public Holidays 2026–2028 — from HKSAR official calendar
// Verify at: www.gov.hk/en/residents/government/publicholiday/
// Dates marked (est.) are computed from the Chinese lunar calendar and may shift by ±1 day
export const HK_PUBLIC_HOLIDAYS = new Set<string>([
  // ── 2026 ──────────────────────────────────────────────
  '2026-01-01', // New Year's Day
  '2026-02-17', // Lunar New Year Day 1 (Year of Horse)
  '2026-02-18', // Lunar New Year Day 2
  '2026-02-19', // Lunar New Year Day 3
  '2026-04-03', // Good Friday (Easter = Apr 5)
  '2026-04-04', // Day after Good Friday / Ching Ming (est.)
  '2026-04-05', // Ching Ming Festival (est.) / Easter Sunday
  '2026-04-06', // Easter Monday
  '2026-05-01', // Labour Day
  '2026-05-21', // Buddha's Birthday (4th lunar month 8th day, est.)
  '2026-06-19', // Tuen Ng Festival (5th lunar month 5th day, est.)
  '2026-07-01', // HKSAR Establishment Day
  '2026-09-26', // Day following Chinese Mid-Autumn Festival (est.)
  '2026-10-01', // National Day
  '2026-10-21', // Chung Yeung Festival (9th lunar month 9th day, est.)
  '2026-12-25', // Christmas Day
  '2026-12-26', // Boxing Day

  // ── 2027 ──────────────────────────────────────────────
  '2027-01-01', // New Year's Day
  '2027-02-06', // Lunar New Year Day 1 (Year of Goat)
  '2027-02-07', // Lunar New Year Day 2
  '2027-02-08', // Lunar New Year Day 3
  '2027-03-26', // Good Friday (Easter = Mar 28)
  '2027-03-27', // Day after Good Friday
  '2027-03-29', // Easter Monday
  '2027-04-05', // Ching Ming Festival
  '2027-05-01', // Labour Day
  '2027-05-11', // Buddha's Birthday (est.)
  '2027-06-09', // Tuen Ng Festival (est.)
  '2027-07-01', // HKSAR Establishment Day
  '2027-09-15', // Day following Chinese Mid-Autumn Festival (est.)
  '2027-10-01', // National Day
  '2027-10-09', // Chung Yeung Festival (est.)
  '2027-12-25', // Christmas Day
  '2027-12-27', // Boxing Day (substitute — Dec 26 is Saturday)

  // ── 2028 ──────────────────────────────────────────────
  '2028-01-01', // New Year's Day
  '2028-01-26', // Lunar New Year Day 1 (Year of Monkey)
  '2028-01-27', // Lunar New Year Day 2
  '2028-01-28', // Lunar New Year Day 3
  '2028-04-04', // Ching Ming Festival
  '2028-04-14', // Good Friday (Easter = Apr 16)
  '2028-04-15', // Day after Good Friday
  '2028-04-17', // Easter Monday
  '2028-05-01', // Labour Day
  '2028-05-30', // Buddha's Birthday (est.)
  '2028-06-27', // Tuen Ng Festival (est.)
  '2028-07-01', // HKSAR Establishment Day
  '2028-09-03', // Day following Chinese Mid-Autumn Festival (est.)
  '2028-10-01', // National Day
  '2028-10-28', // Chung Yeung Festival (est.)
  '2028-12-25', // Christmas Day
  '2028-12-26', // Boxing Day
])

// Returns 'work' if current HKT time is Mon–Fri 10:00–19:59 and not a public holiday.
// Runs server-side or on initial page load only (called from root page redirect).
export function getAutoMode(): 'work' | 'personal' {
  const now = new Date()
  // HKT = UTC+8
  const hktMs = now.getTime() + 8 * 60 * 60 * 1000
  const hkt = new Date(hktMs)

  const dow  = hkt.getUTCDay()    // 0=Sun, 1=Mon … 6=Sat
  const hour = hkt.getUTCHours()  // 0–23
  const dateStr = [
    hkt.getUTCFullYear(),
    String(hkt.getUTCMonth() + 1).padStart(2, '0'),
    String(hkt.getUTCDate()).padStart(2, '0'),
  ].join('-')

  const isWeekday   = dow >= 1 && dow <= 5
  const isWorkHour  = hour >= 10 && hour <= 19   // 10:00–19:59
  const isHoliday   = HK_PUBLIC_HOLIDAYS.has(dateStr)

  if (isWeekday && isWorkHour && !isHoliday) return 'work'
  return 'personal'
}

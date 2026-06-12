import type { Cycle } from '@/shared/types'

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (__, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1]
      else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

function fuzzyContains(text: string, word: string): boolean {
  if (text.includes(word)) return true
  const maxDist = word.length <= 2 ? 0 : word.length <= 4 ? 1 : 2
  if (maxDist === 0) return false
  for (let i = 0; i <= text.length - word.length + maxDist; i++) {
    const sub = text.slice(i, i + word.length)
    if (levenshtein(word, sub) <= maxDist) return true
  }
  return false
}

export function fuzzyMatch(text: string, query: string): boolean {
  const t = text.toLowerCase()
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  return words.every(w => fuzzyContains(t, w))
}

export function matchesCycle(cycle: Cycle, query: string): boolean {
  if (!query.trim()) return true
  const fields: string[] = [cycle.title, cycle.triggerLabel ?? '']
  for (const item of cycle.items ?? []) {
    fields.push(item.label)
    for (const sub of item.subItems ?? []) fields.push(sub.label)
  }
  for (const phase of cycle.phases ?? []) {
    fields.push(phase.title)
    for (const item of phase.items) {
      fields.push(item.label)
      for (const sub of item.subItems ?? []) fields.push(sub.label)
    }
  }
  return fields.some(f => fuzzyMatch(f, query))
}

import type { Cycle, ChecklistItem } from '@/shared/types'

export type CycleFilter = 'All' | 'Must' | '⚠️ Urgent' | 'Light' | 'Medium' | 'Heavy' | 'Weekly' | 'Monthly' | 'Latest'

export const CADENCE_FILTERS = new Set<CycleFilter>(['Weekly', 'Monthly'])

export function itemMatchesFilter(item: ChecklistItem, cycle: Cycle, filter: CycleFilter): boolean {
  if (filter === 'All') return true
  if (CADENCE_FILTERS.has(filter)) return true
  const eff = item.effort ?? cycle.effort
  if (filter === 'Light')    return eff === 'quick'
  if (filter === 'Medium')   return eff === 'medium'
  if (filter === 'Heavy')    return eff === 'heavy'
  if (filter === 'Must')      return !!(item.must || cycle.must)
  if (filter === '⚠️ Urgent') return !!(item.urgent || item.must || cycle.urgent || cycle.must)
  return true
}

// Returns only the leaf nodes (items with no sub-items)
function getLeaves(items: ChecklistItem[]): ChecklistItem[] {
  return items.flatMap(item =>
    item.subItems && item.subItems.length > 0
      ? getLeaves(item.subItems)
      : [item]
  )
}

// Flattens a list to leaf items for filter rendering:
// - items with sub-items → only their matching leaves are shown
// - items without sub-items (true leaves) → shown if they match
export function filterToLeaves(items: ChecklistItem[], cycle: Cycle, filter: CycleFilter): ChecklistItem[] {
  if (filter === 'All' || CADENCE_FILTERS.has(filter)) return items
  return items.flatMap(item =>
    item.subItems && item.subItems.length > 0
      ? item.subItems.filter(sub => itemMatchesFilter(sub, cycle, filter))
      : itemMatchesFilter(item, cycle, filter) ? [item] : []
  )
}

export function cycleHasMatchingItems(cycle: Cycle, filter: CycleFilter): boolean {
  if (filter === 'All' || filter === 'Latest') return true
  if (filter === 'Must') return !!cycle.must
  const leaves = cycle.phases
    ? cycle.phases.flatMap(p => getLeaves(p.items))
    : getLeaves(cycle.items ?? [])
  return leaves.some(item => itemMatchesFilter(item, cycle, filter))
}

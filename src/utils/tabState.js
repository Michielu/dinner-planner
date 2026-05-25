/**
 * Returns the display state for a planner tab.
 *
 * @param {string} tab - The tab to evaluate ('staples' | 'pantry' | 'plan' | 'grocery')
 * @param {string} currentPhase - The currently active phase
 * @param {Set<string>} visitedPhases - Phases the user has reached at least once
 * @returns {'active' | 'visited' | 'unvisited'}
 */
export function getTabState(tab, currentPhase, visitedPhases) {
  if (tab === currentPhase) return 'active'
  if (visitedPhases.has(tab)) return 'visited'
  return 'unvisited'
}

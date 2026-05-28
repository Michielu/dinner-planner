/**
 * Merges persisted selected staple IDs with any staples added after the plan started.
 *
 * Staples with created_at > planCreatedAt are auto-checked (they were added mid-week
 * after the plan was created). Staples that pre-date the plan must be explicitly
 * selected by the user via the StapleChecker.
 *
 * @param {string[]} persistedIds - UUIDs previously saved to week_plan.selected_staple_ids
 * @param {Array<{id: string, created_at: string}>} staples - full master staple list
 * @param {string|null} planCreatedAt - ISO timestamp of week_plan.created_at
 * @returns {string[]} resolved list of selected IDs
 */
export function resolveSelectedStaples(persistedIds, staples, planCreatedAt) {
  if (!planCreatedAt) return persistedIds
  const planDate = new Date(planCreatedAt)
  const newIds = staples
    .filter(s => new Date(s.created_at) > planDate && !persistedIds.includes(s.id))
    .map(s => s.id)
  return [...persistedIds, ...newIds]
}

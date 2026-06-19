const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const SLOT_SPECIAL = {
  eating_out: { label: '🍽️ Eating Out', style: 'text-stone-grey italic' },
  flex:        { label: '🎲 Flex Night',  style: 'text-stone-grey italic' },
}

/**
 * Props:
 *   slots: Record<string, slot[] | null>
 *   onSlotClick: (day: string) => void
 */
export function WeekGrid({ slots, onSlotClick }) {
  return (
    <div className="space-y-2">
      {DAYS.map(day => {
        const key = day.toLowerCase()
        const slotArr = slots[key] ?? []
        const recipes = slotArr.filter(s => s.type === 'recipe')
        const special = slotArr.find(s => s.type !== 'recipe')

        return (
          <button
            key={day}
            onClick={() => onSlotClick(key)}
            className="w-full flex items-center gap-4 bg-willow-mist rounded-2xl px-5 py-4 shadow-card hover:opacity-90 transition-opacity text-left"
          >
            <span className="w-24 text-sm text-stone-grey font-bold tracking-wide shrink-0">{day}</span>
            <div className="flex-1 min-w-0">
              {special ? (
                <span className={`text-sm ${SLOT_SPECIAL[special.type].style}`}>
                  {SLOT_SPECIAL[special.type].label}
                </span>
              ) : recipes.length > 0 ? (
                <span className="text-sm text-soil-shadow font-bold uppercase">
                  {recipes.map(s => s.recipe?.name).join(' + ')}
                </span>
              ) : (
                <span className="text-sm text-stone-grey/50">+ pick meal</span>
              )}
            </div>
            {recipes.length > 1 && (
              <span className="text-xs bg-garden-patch/20 text-garden-patch rounded-full px-2 py-0.5 font-bold shrink-0">
                {recipes.length}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

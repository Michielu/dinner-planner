const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const SLOT_DISPLAY = {
  eating_out: { label: '🍽️ Eating Out', style: 'text-stone-grey italic' },
  flex:        { label: '🎲 Flex Night',  style: 'text-stone-grey italic' },
}

/**
 * Props:
 *   slots: Record<string, {type: 'recipe'|'eating_out'|'flex', recipe?: {id,name}} | null>
 *   onSlotClick: (day: string) => void
 */
export function WeekGrid({ slots, onSlotClick }) {
  return (
    <div className="space-y-2">
      {DAYS.map(day => {
        const key = day.toLowerCase()
        const slot = slots[key]
        const display = slot?.type === 'recipe'
          ? { label: slot.recipe?.name ?? 'Recipe', style: 'text-soil-shadow font-bold' }
          : slot
          ? SLOT_DISPLAY[slot.type]
          : null

        return (
          <button
            key={day}
            onClick={() => onSlotClick(key)}
            className="w-full flex items-center gap-4 bg-willow-mist rounded-2xl px-5 py-4 shadow-card hover:opacity-90 transition-opacity text-left"
          >
            <span className="w-24 text-sm text-stone-grey font-bold tracking-wide shrink-0">{day}</span>
            {display ? (
              <span className={`text-sm ${display.style}`}>{display.label}</span>
            ) : (
              <span className="text-sm text-stone-grey/50">+ pick meal</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

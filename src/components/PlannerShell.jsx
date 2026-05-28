import { getTabState } from '../utils/tabState'

const TABS = [
  { key: 'staples', label: 'Staples' },
  { key: 'pantry',  label: 'Pantry'  },
  { key: 'plan',    label: 'Plan'    },
]

function tabClass(state) {
  const base = 'flex-1 py-3 text-xs font-bold tracking-wide transition-colors'
  if (state === 'active')
    return `${base} text-garden-patch border-b-2 border-garden-patch -mb-0.5 bg-fresh-herb/10`
  if (state === 'visited')
    return `${base} text-garden-patch hover:text-soil-shadow`
  return `${base} text-stone-grey hover:text-soil-shadow`
}

function tabLabel(label, state) {
  return state === 'visited' ? `✓ ${label}` : label
}

/**
 * Props:
 *   phase: 'staples' | 'pantry' | 'plan' | 'grocery'
 *   visitedPhases: Set<string>
 *   onNavigate: (phase: string) => void
 *   children: React.ReactNode
 */
export function PlannerShell({ phase, visitedPhases, onNavigate, onReset, children }) {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="bg-willow-mist rounded-card shadow-card overflow-hidden">
        {/* Tab bar */}
        <div className="flex items-center border-b-2 border-willow-mist bg-willow-mist/50">
          <div role="tablist" className="flex flex-1">
            {TABS.map(tab => {
              const state = getTabState(tab.key, phase, visitedPhases)
              return (
                <button
                  key={tab.key}
                  role="tab"
                  type="button"
                  aria-selected={state === 'active'}
                  onClick={() => onNavigate(tab.key)}
                  className={tabClass(state)}
                >
                  {tabLabel(tab.label, state)}
                </button>
              )
            })}
          </div>
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="px-4 py-3 text-xs text-stone-grey hover:text-soil-shadow font-bold shrink-0 transition-colors"
            >
              ↺ Start over
            </button>
          )}
        </div>

        {/* Step content */}
        <div>
          {children}
        </div>
      </div>
    </div>
  )
}

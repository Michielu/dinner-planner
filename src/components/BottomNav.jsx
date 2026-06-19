import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/',        label: 'This Week', icon: '🗓', end: true  },
  { to: '/recipes', label: 'Recipes',   icon: '🍳', end: false },
  { to: '/grocery', label: 'Grocery',   icon: '🛒', end: false },
  { to: '/manage',  label: 'Catalog',   icon: '📋', end: false },
]

export function BottomNav() {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-willow-mist border-t border-willow-mist/70 shadow-card"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex">
        {TABS.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2 text-xs font-bold tracking-wide transition-colors ${
                isActive ? 'text-garden-patch' : 'text-stone-grey'
              }`
            }
          >
            <span className="text-xl leading-tight">{tab.icon}</span>
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

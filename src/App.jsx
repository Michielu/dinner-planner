import { Routes, Route, NavLink } from 'react-router-dom'
import { ConnectionBanner } from './components/ConnectionBanner'
import PlannerPage from './pages/PlannerPage'
import RecipesPage from './pages/RecipesPage'
import ManagePage from './pages/ManagePage'

function NavItem({ to, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-4 py-2 rounded-pill text-sm font-bold tracking-wide transition-colors ${
          isActive
            ? 'bg-garden-patch text-fresh-herb'
            : 'text-stone-grey hover:text-soil-shadow'
        }`
      }
    >
      {label}
    </NavLink>
  )
}

export default function App() {
  return (
    <div className="min-h-screen bg-field-cream font-body text-soil-shadow">
      <ConnectionBanner />
      <nav className="bg-willow-mist shadow-card px-6 py-4 flex items-center gap-3">
        <span className="font-display font-light text-2xl tracking-tight text-garden-patch mr-4">
          Dinner Planner
        </span>
        <NavItem to="/" label="This Week" />
        <NavItem to="/recipes" label="Recipes" />
        <NavItem to="/manage" label="Staples & Categories" />
      </nav>
      <main className="max-w-4xl mx-auto">
        <Routes>
          <Route path="/" element={<PlannerPage />} />
          <Route path="/recipes" element={<RecipesPage />} />
          <Route path="/manage" element={<ManagePage />} />
        </Routes>
      </main>
    </div>
  )
}

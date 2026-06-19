import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import { ConnectionBanner } from './components/ConnectionBanner'
import { BottomNav } from './components/BottomNav'
import { useAuth } from './hooks/useAuth'
import PlannerPage from './pages/PlannerPage'
import RecipesPage from './pages/RecipesPage'
import ManagePage from './pages/ManagePage'
import GroceryPage from './pages/GroceryPage'
import LoginPage from './pages/LoginPage'

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
  const { email, signOut } = useAuth()
  const location = useLocation()
  const isLoginRoute = location.pathname === '/login'

  if (!email && !isLoginRoute) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="min-h-screen bg-field-cream font-body text-soil-shadow">
      <ConnectionBanner />
      {!isLoginRoute && (
        <nav className="bg-willow-mist shadow-card px-6 py-4 flex items-center gap-3">
          <span className="font-display font-light text-2xl tracking-tight text-garden-patch mr-4">
            Dinner Planner
          </span>
          <div className="hidden md:flex items-center gap-3">
            <NavItem to="/" label="This Week" />
            <NavItem to="/recipes" label="Recipes" />
            <NavItem to="/grocery" label="Grocery List" />
            <NavItem to="/manage" label="Catalog" />
          </div>
          <div className="ml-auto hidden md:block">
            <button
              onClick={signOut}
              className="text-xs text-stone-grey hover:text-soil-shadow transition-colors"
            >
              Sign out
            </button>
          </div>
        </nav>
      )}
      <main className={`max-w-4xl mx-auto ${isLoginRoute ? '' : 'pb-16 md:pb-0'}`}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<PlannerPage />} />
          <Route path="/recipes" element={<RecipesPage />} />
          <Route path="/grocery" element={<GroceryPage />} />
          <Route path="/manage" element={<ManagePage />} />
        </Routes>
      </main>
      {!isLoginRoute && <BottomNav />}
    </div>
  )
}

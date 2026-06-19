import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const DEFAULT_CATEGORIES = [
  { name: 'Pasta',      sort_order: 1 },
  { name: 'Soup',       sort_order: 2 },
  { name: 'Salad',      sort_order: 3 },
  { name: 'Chicken',    sort_order: 4 },
  { name: 'Beef',       sort_order: 5 },
  { name: 'Seafood',    sort_order: 6 },
  { name: 'Vegetarian', sort_order: 7 },
  { name: 'Quick',      sort_order: 8 },
]

export default function LoginPage() {
  const navigate = useNavigate()
  const { email: storedEmail, signIn } = useAuth()

  const [input, setInput]          = useState('')
  const [view, setView]            = useState('form')  // 'form' | 'confirm'
  const [error, setError]          = useState(null)
  const [loading, setLoading]      = useState(false)
  const [pendingEmail, setPending] = useState(null)

  if (storedEmail) {
    navigate('/', { replace: true })
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = input.trim().toLowerCase()
    if (!trimmed) return
    setError(null)
    setLoading(true)

    const { data, error: queryErr } = await supabase
      .from('allowed_emails')
      .select('email')
      .eq('email', trimmed)
      .maybeSingle()

    setLoading(false)

    if (queryErr) {
      setError('Something went wrong. Please try again.')
      return
    }

    if (data) {
      signIn(trimmed)
      navigate('/', { replace: true })
    } else {
      setPending(trimmed)
      setView('confirm')
    }
  }

  async function handleConfirmYes() {
    setError(null)
    setLoading(true)

    const { error: insertErr } = await supabase
      .from('allowed_emails')
      .insert({ email: pendingEmail })

    if (insertErr) {
      setLoading(false)
      setError('Could not create account. Please try again.')
      return
    }

    await supabase
      .from('meal_categories')
      .insert(DEFAULT_CATEGORIES.map(c => ({ ...c, user_email: pendingEmail })))

    setLoading(false)
    signIn(pendingEmail)
    navigate('/', { replace: true })
  }

  function handleConfirmNo() {
    setPending(null)
    setView('form')
    setInput('')
  }

  return (
    <div className="min-h-screen bg-field-cream flex items-center justify-center p-4">
      <div className="bg-grain-sand rounded-3xl shadow-card w-full max-w-sm p-8">
        <h1 className="font-display font-light text-3xl tracking-tight text-soil-shadow mb-6">
          Dinner Planner
        </h1>

        {view === 'form' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-stone-grey mb-1">Email</label>
              <input
                type="email"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                className="w-full border border-willow-mist rounded-2xl bg-field-cream px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-garden-patch text-fresh-herb font-bold py-3 rounded-2xl text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Checking…' : 'Sign in'}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-stone-grey">
              We don't recognize{' '}
              <span className="font-bold text-soil-shadow">{pendingEmail}</span>.
              Create a new account?
            </p>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={handleConfirmYes}
                disabled={loading}
                className="flex-1 bg-garden-patch text-fresh-herb font-bold py-3 rounded-2xl text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? 'Creating…' : 'Yes, create account'}
              </button>
              <button
                onClick={handleConfirmNo}
                disabled={loading}
                className="flex-1 border-2 border-willow-mist text-stone-grey font-bold py-3 rounded-2xl text-sm hover:border-garden-patch hover:text-soil-shadow transition-colors"
              >
                No, go back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

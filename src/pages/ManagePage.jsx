import { useState } from 'react'
import { useRecipes } from '../hooks/useRecipes'
import { useStaples } from '../hooks/useStaples'
import { useGroceryExtras } from '../hooks/useGroceryExtras'
import { useToast, Toast } from '../components/Toast'
import { STORES } from '../utils/stores'

export default function ManagePage() {
  const { categories, addCategory, deleteCategory } = useRecipes()
  const { staples, addStaple, updateStaple, deleteStaple } = useStaples()
  const { extras, addExtra, removeExtra } = useGroceryExtras()
  const { toast, showToast, dismissToast } = useToast()

  const [newCategory, setNewCategory] = useState('')
  const [newStaple, setNewStaple] = useState({ name: '', store: 'aldi', notes: '' })
  const [editingStaple, setEditingStaple] = useState(null)
  const [newExtra, setNewExtra] = useState({ name: '', store: 'aldi' })
  const [extrasSearch, setExtrasSearch] = useState('')

  const filteredExtras = extrasSearch.trim()
    ? extras.filter(e => e.name.toLowerCase().includes(extrasSearch.toLowerCase()))
    : extras

  async function handleAddCategory(e) {
    e.preventDefault()
    if (!newCategory.trim()) return
    try {
      await addCategory(newCategory.trim())
      setNewCategory('')
    } catch {
      showToast("Couldn't save category, try again")
    }
  }

  async function handleDeleteCategory(id) {
    if (!confirm('Delete this category? Recipes using it will become uncategorised.')) return
    try {
      await deleteCategory(id)
    } catch {
      showToast("Couldn't delete category, try again")
    }
  }

  async function handleAddStaple(e) {
    e.preventDefault()
    if (!newStaple.name.trim()) return
    try {
      await addStaple({ name: newStaple.name.trim(), store: newStaple.store, notes: newStaple.notes.trim() || null })
      setNewStaple({ name: '', store: 'aldi', notes: '' })
    } catch {
      showToast("Couldn't save staple, try again")
    }
  }

  async function handleUpdateStaple(e) {
    e.preventDefault()
    try {
      await updateStaple(editingStaple.id, {
        name: editingStaple.name.trim(),
        store: editingStaple.store,
        notes: editingStaple.notes?.trim() || null,
      })
      setEditingStaple(null)
    } catch {
      showToast("Couldn't update staple, try again")
    }
  }

  async function handleDeleteStaple(id) {
    if (!confirm('Remove this staple from the weekly grocery list?')) return
    try {
      await deleteStaple(id)
    } catch {
      showToast("Couldn't delete staple, try again")
    }
  }

  async function handleAddExtra(e) {
    e.preventDefault()
    if (!newExtra.name.trim()) return
    try {
      await addExtra(newExtra.name.trim(), newExtra.store)
      setNewExtra({ name: '', store: 'aldi' })
      setExtrasSearch('')
    } catch {
      showToast("Couldn't save item, try again")
    }
  }

  async function handleRemoveExtra(id) {
    if (!confirm('Remove this item from the extras list?')) return
    try {
      await removeExtra(id)
      if (extras.length === 1) setExtrasSearch('')
    } catch {
      showToast("Couldn't remove item, try again")
    }
  }

  return (
    <div className="p-6 space-y-10 max-w-2xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />}

      {/* Categories */}
      <section>
        <h2 className="font-display font-light text-2xl text-soil-shadow mb-4">Meal Categories</h2>
        <ul className="space-y-2 mb-4">
          {categories.map(cat => (
            <li key={cat.id} className="flex items-center justify-between bg-willow-mist rounded-2xl px-5 py-3 shadow-card">
              <span className="font-bold text-soil-shadow">{cat.name}</span>
              <button
                onClick={() => handleDeleteCategory(cat.id)}
                className="text-stone-grey hover:text-red-500 text-sm font-bold transition-colors"
              >
                Remove
              </button>
            </li>
          ))}
          {categories.length === 0 && (
            <li className="text-stone-grey text-sm px-2">No categories yet.</li>
          )}
        </ul>
        <form onSubmit={handleAddCategory} className="flex gap-2">
          <input
            value={newCategory}
            onChange={e => setNewCategory(e.target.value)}
            placeholder="New category name"
            className="flex-1 border border-willow-mist rounded-2xl bg-field-cream px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
          />
          <button type="submit" className="bg-fresh-herb text-soil-shadow font-bold px-5 py-2.5 rounded-pill shadow-card hover:opacity-90 transition-opacity text-sm">
            Add
          </button>
        </form>
      </section>

      {/* Staples */}
      <section>
        <h2 className="font-display font-light text-2xl text-soil-shadow mb-1">Staple Items</h2>
        <p className="text-sm text-stone-grey mb-4">These appear on every planning session for quick selection.</p>
        <ul className="space-y-2 mb-4">
          {staples.map(s => (
            <li key={s.id} className="bg-willow-mist rounded-2xl px-5 py-3 shadow-card">
              {editingStaple?.id === s.id ? (
                <form onSubmit={handleUpdateStaple} className="flex flex-wrap gap-2">
                  <input
                    value={editingStaple.name}
                    onChange={e => setEditingStaple(p => ({ ...p, name: e.target.value }))}
                    className="flex-1 min-w-32 border border-willow-mist rounded-xl bg-field-cream px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
                  />
                  <select
                    value={editingStaple.store}
                    onChange={e => setEditingStaple(p => ({ ...p, store: e.target.value }))}
                    className="border border-willow-mist rounded-xl bg-field-cream px-3 py-1.5 text-sm focus:outline-none"
                  >
                    {STORES.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
                  </select>
                  <input
                    value={editingStaple.notes || ''}
                    onChange={e => setEditingStaple(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Note (optional)"
                    className="flex-1 min-w-40 border border-willow-mist rounded-xl bg-field-cream px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
                  />
                  <button type="submit" className="bg-fresh-herb text-soil-shadow font-bold px-4 py-1.5 rounded-pill text-sm hover:opacity-90">Save</button>
                  <button type="button" onClick={() => setEditingStaple(null)} className="text-stone-grey px-2 text-sm">Cancel</button>
                </form>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-soil-shadow">{s.name}</span>
                    <span className="text-xs text-stone-grey ml-2">{STORES.find(st => st.value === s.store)?.label}</span>
                    {s.notes && <span className="text-xs text-stone-grey ml-2">— {s.notes}</span>}
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setEditingStaple(s)} className="text-garden-patch text-sm font-bold hover:underline">Edit</button>
                    <button onClick={() => handleDeleteStaple(s.id)} className="text-stone-grey hover:text-red-500 text-sm font-bold transition-colors">Remove</button>
                  </div>
                </div>
              )}
            </li>
          ))}
          {staples.length === 0 && (
            <li className="text-stone-grey text-sm px-2">No staples yet.</li>
          )}
        </ul>
        <form onSubmit={handleAddStaple} className="flex flex-wrap gap-2">
          <input
            value={newStaple.name}
            onChange={e => setNewStaple(p => ({ ...p, name: e.target.value }))}
            placeholder="Item name (e.g. yogurt)"
            className="flex-1 min-w-40 border border-willow-mist rounded-2xl bg-field-cream px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
          />
          <select
            value={newStaple.store}
            onChange={e => setNewStaple(p => ({ ...p, store: e.target.value }))}
            className="border border-willow-mist rounded-2xl bg-field-cream px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
          >
            {STORES.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
          </select>
          <input
            value={newStaple.notes}
            onChange={e => setNewStaple(p => ({ ...p, notes: e.target.value }))}
            placeholder="Note (optional)"
            className="flex-1 min-w-40 border border-willow-mist rounded-2xl bg-field-cream px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
          />
          <button type="submit" className="bg-fresh-herb text-soil-shadow font-bold px-5 py-2.5 rounded-pill shadow-card hover:opacity-90 transition-opacity text-sm">
            Add
          </button>
        </form>
      </section>

      {/* Extra Grocery Items */}
      <section>
        <h2 className="font-display font-light text-2xl text-soil-shadow mb-1">Extra Grocery Items</h2>
        <p className="text-sm text-stone-grey mb-4">One-off items to grab this week — not a recurring staple.</p>

        {extras.length > 0 && (
          <div className="relative mb-3">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-grey text-sm" aria-hidden="true">🔍</span>
            <input
              value={extrasSearch}
              onChange={e => setExtrasSearch(e.target.value)}
              placeholder="Search extras…"
              className="w-full border border-willow-mist rounded-2xl bg-field-cream pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
            />
          </div>
        )}

        <ul className="space-y-2 mb-4">
          {filteredExtras.map(extra => (
            <li key={extra.id} className="flex items-center justify-between bg-willow-mist rounded-2xl px-5 py-3 shadow-card">
              <div>
                <span className="font-bold text-soil-shadow">{extra.name}</span>
                <span className="text-xs text-stone-grey ml-2">{STORES.find(s => s.value === extra.store)?.label}</span>
              </div>
              <button
                onClick={() => handleRemoveExtra(extra.id)}
                className="text-stone-grey hover:text-red-500 text-sm font-bold transition-colors"
              >
                Remove
              </button>
            </li>
          ))}
          {extras.length === 0 && (
            <li className="text-stone-grey text-sm px-2">No extra items yet.</li>
          )}
          {extras.length > 0 && filteredExtras.length === 0 && (
            <li className="text-stone-grey text-sm px-2">No items match "{extrasSearch}".</li>
          )}
        </ul>

        <form onSubmit={handleAddExtra} className="flex flex-wrap gap-2">
          <input
            value={newExtra.name}
            onChange={e => setNewExtra(p => ({ ...p, name: e.target.value }))}
            placeholder="Item name (e.g. paper towels)"
            className="flex-1 min-w-40 border border-willow-mist rounded-2xl bg-field-cream px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
          />
          <select
            value={newExtra.store}
            onChange={e => setNewExtra(p => ({ ...p, store: e.target.value }))}
            className="border border-willow-mist rounded-2xl bg-field-cream px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
          >
            {STORES.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
          </select>
          <button type="submit" className="bg-fresh-herb text-soil-shadow font-bold px-5 py-2.5 rounded-pill shadow-card hover:opacity-90 transition-opacity text-sm">
            Add
          </button>
        </form>
      </section>
    </div>
  )
}

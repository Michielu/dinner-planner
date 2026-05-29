import { useState } from 'react'
import { useRecipes } from '../hooks/useRecipes'
import { useStaples } from '../hooks/useStaples'
import { useIngredients } from '../hooks/useIngredients'
import { useToast, Toast } from '../components/Toast'
import { STORES } from '../utils/stores'

const TABS = [
  { key: 'staples',     label: 'Staples' },
  { key: 'ingredients', label: 'Ingredients' },
  { key: 'categories',  label: 'Categories' },
]

export default function ManagePage() {
  const { categories, addCategory, deleteCategory } = useRecipes()
  const { staples, addStaple, updateStaple, deleteStaple } = useStaples()
  const { ingredients, deleteIngredient, updateIngredient, findOrCreate } = useIngredients()
  const { toast, showToast, dismissToast } = useToast()

  const [activeTab, setActiveTab] = useState('staples')

  const [newCategory, setNewCategory] = useState('')
  const [newStaple, setNewStaple] = useState({ name: '', store: 'aldi', notes: '' })
  const [editingStaple, setEditingStaple] = useState(null)
  const [editingIngredient, setEditingIngredient] = useState(null)
  const [newIngredient, setNewIngredient] = useState({ name: '', store: 'aldi' })
  const [ingredientSearch, setIngredientSearch] = useState('')

  const filteredIngredients = ingredientSearch.trim()
    ? ingredients.filter(i => i.name.toLowerCase().includes(ingredientSearch.toLowerCase()))
    : ingredients

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

  async function handleAddIngredient(e) {
    e.preventDefault()
    if (!newIngredient.name.trim()) return
    try {
      await findOrCreate(newIngredient.name.trim(), newIngredient.store)
      setNewIngredient({ name: '', store: 'aldi' })
    } catch {
      showToast("Couldn't save ingredient, try again")
    }
  }

  async function handleUpdateIngredient(e) {
    e.preventDefault()
    try {
      await updateIngredient(editingIngredient.id, {
        name: editingIngredient.name.trim(),
        store: editingIngredient.store,
      })
      setEditingIngredient(null)
    } catch {
      showToast("Couldn't update ingredient, try again")
    }
  }

  async function handleDeleteIngredient(id) {
    if (!confirm('Delete this ingredient? It will be removed from any recipes that use it.')) return
    try {
      await deleteIngredient(id)
    } catch {
      showToast("Couldn't delete ingredient, try again")
    }
  }

  async function handleMoveToIngredients(staple) {
    try {
      await findOrCreate(staple.name, staple.store)
      await deleteStaple(staple.id)
      setActiveTab('ingredients')
    } catch {
      showToast("Couldn't move item, try again")
    }
  }

  async function handleMoveToStaples(ingredient) {
    try {
      await addStaple({ name: ingredient.name, store: ingredient.store, notes: null })
      await deleteIngredient(ingredient.id)
      setActiveTab('staples')
    } catch {
      showToast("Couldn't move item, try again")
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />}

      <div className="bg-willow-mist rounded-card shadow-card overflow-hidden">

        {/* Tab bar */}
        <div role="tablist" className="flex border-b-2 border-willow-mist bg-willow-mist/50">
          {TABS.map(tab => (
            <button
              key={tab.key}
              role="tab"
              type="button"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-3 text-xs font-bold tracking-wide transition-colors ${
                activeTab === tab.key
                  ? 'text-garden-patch border-b-2 border-garden-patch -mb-0.5 bg-fresh-herb/10'
                  : 'text-stone-grey hover:text-soil-shadow'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-6 space-y-4">

          {activeTab === 'staples' && (
            <>
              <p className="text-sm text-stone-grey">Items we want to make sure we have every week.</p>
              <ul className="space-y-2">
                {staples.map(s => (
                  <li key={s.id} className="bg-field-cream rounded-2xl px-5 py-3 shadow-card">
                    {editingStaple?.id === s.id ? (
                      <form onSubmit={handleUpdateStaple} className="flex flex-wrap gap-2">
                        <input
                          value={editingStaple.name}
                          onChange={e => setEditingStaple(p => ({ ...p, name: e.target.value }))}
                          className="flex-1 min-w-32 border border-willow-mist rounded-xl bg-willow-mist px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
                        />
                        <select
                          value={editingStaple.store}
                          onChange={e => setEditingStaple(p => ({ ...p, store: e.target.value }))}
                          className="border border-willow-mist rounded-xl bg-willow-mist px-3 py-1.5 text-sm focus:outline-none"
                        >
                          {STORES.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
                        </select>
                        <input
                          value={editingStaple.notes || ''}
                          onChange={e => setEditingStaple(p => ({ ...p, notes: e.target.value }))}
                          placeholder="Note (optional)"
                          className="flex-1 min-w-40 border border-willow-mist rounded-xl bg-willow-mist px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
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
                          <button onClick={() => handleMoveToIngredients(s)} className="text-stone-grey hover:text-soil-shadow text-sm font-bold transition-colors">→ Ingredients</button>
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
              <form onSubmit={handleAddStaple} className="flex flex-wrap gap-2 pt-2">
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
            </>
          )}

          {activeTab === 'ingredients' && (
            <>
              <p className="text-sm text-stone-grey">One-off or occasional items used in recipes and the grocery list.</p>
              {ingredients.length > 4 && (
                <input
                  value={ingredientSearch}
                  onChange={e => setIngredientSearch(e.target.value)}
                  placeholder="Search ingredients…"
                  className="w-full border border-willow-mist rounded-2xl bg-field-cream px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
                />
              )}
              <ul className="space-y-2">
                {filteredIngredients.map(ing => (
                  <li key={ing.id} className="bg-field-cream rounded-2xl px-5 py-3 shadow-card">
                    {editingIngredient?.id === ing.id ? (
                      <form onSubmit={handleUpdateIngredient} className="flex flex-wrap gap-2">
                        <input
                          value={editingIngredient.name}
                          onChange={e => setEditingIngredient(p => ({ ...p, name: e.target.value }))}
                          className="flex-1 min-w-32 border border-willow-mist rounded-xl bg-willow-mist px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
                        />
                        <select
                          value={editingIngredient.store}
                          onChange={e => setEditingIngredient(p => ({ ...p, store: e.target.value }))}
                          className="border border-willow-mist rounded-xl bg-willow-mist px-3 py-1.5 text-sm focus:outline-none"
                        >
                          {STORES.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
                        </select>
                        <button type="submit" className="bg-fresh-herb text-soil-shadow font-bold px-4 py-1.5 rounded-pill text-sm hover:opacity-90">Save</button>
                        <button type="button" onClick={() => setEditingIngredient(null)} className="text-stone-grey px-2 text-sm">Cancel</button>
                      </form>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-soil-shadow">{ing.name}</span>
                          <span className="text-xs text-stone-grey ml-2">{STORES.find(st => st.value === ing.store)?.label}</span>
                        </div>
                        <div className="flex gap-3">
                          <button onClick={() => setEditingIngredient(ing)} className="text-garden-patch text-sm font-bold hover:underline">Edit</button>
                          <button onClick={() => handleMoveToStaples(ing)} className="text-stone-grey hover:text-soil-shadow text-sm font-bold transition-colors">→ Staples</button>
                          <button onClick={() => handleDeleteIngredient(ing.id)} className="text-stone-grey hover:text-red-500 text-sm font-bold transition-colors">Remove</button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
                {ingredients.length === 0 && (
                  <li className="text-stone-grey text-sm px-2">No ingredients yet — they're added when you create recipes or add items to the grocery list.</li>
                )}
                {ingredients.length > 0 && filteredIngredients.length === 0 && (
                  <li className="text-stone-grey text-sm px-2">No ingredients match "{ingredientSearch}".</li>
                )}
              </ul>
              <form onSubmit={handleAddIngredient} className="flex flex-wrap gap-2 pt-2">
                <input
                  value={newIngredient.name}
                  onChange={e => setNewIngredient(p => ({ ...p, name: e.target.value }))}
                  placeholder="Item name (e.g. pasta)"
                  className="flex-1 min-w-40 border border-willow-mist rounded-2xl bg-field-cream px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
                />
                <select
                  value={newIngredient.store}
                  onChange={e => setNewIngredient(p => ({ ...p, store: e.target.value }))}
                  className="border border-willow-mist rounded-2xl bg-field-cream px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
                >
                  {STORES.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
                </select>
                <button type="submit" className="bg-fresh-herb text-soil-shadow font-bold px-5 py-2.5 rounded-pill shadow-card hover:opacity-90 transition-opacity text-sm">
                  Add
                </button>
              </form>
            </>
          )}

          {activeTab === 'categories' && (
            <>
              <ul className="space-y-2">
                {categories.map(cat => (
                  <li key={cat.id} className="flex items-center justify-between bg-field-cream rounded-2xl px-5 py-3 shadow-card">
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
              <form onSubmit={handleAddCategory} className="flex gap-2 pt-2">
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
            </>
          )}

        </div>
      </div>
    </div>
  )
}

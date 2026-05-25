import { describe, it, expect } from 'vitest'
import { generateGroceryList } from '../../src/utils/groceryList.js'

const RECIPES = [
  {
    id: 'r1',
    name: 'Pasta Bolognese',
    ingredients: [
      { id: 'i1', name: 'pasta', store: 'aldi' },
      { id: 'i2', name: 'ground beef', store: 'sams_club' },
    ],
  },
  {
    id: 'r2',
    name: 'Chicken Stir Fry',
    ingredients: [
      { id: 'i3', name: 'chicken breast', store: 'sams_club' },
      { id: 'i1', name: 'pasta', store: 'aldi' }, // duplicate ingredient
    ],
  },
]

const STAPLES = [
  { id: 's1', name: 'yogurt', store: 'sams_club', notes: 'check if running low' },
  { id: 's2', name: 'fruit', store: 'aldi', notes: null },
]

describe('generateGroceryList', () => {
  it('groups recipe ingredients by store', () => {
    const slots = [
      { day: 'monday', type: 'recipe', recipeId: 'r1' },
    ]
    const result = generateGroceryList(slots, RECIPES, [])
    expect(result.aldi).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'pasta', isStaple: false, isExtra: false }),
    ]))
    expect(result.sams_club).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'ground beef', isStaple: false, isExtra: false }),
    ]))
    expect(result.target).toEqual([])
  })

  it('deduplicates ingredients used in multiple recipes', () => {
    const slots = [
      { day: 'monday', type: 'recipe', recipeId: 'r1' },
      { day: 'tuesday', type: 'recipe', recipeId: 'r2' },
    ]
    const result = generateGroceryList(slots, RECIPES, [])
    const aldiNames = result.aldi.map(i => i.name)
    expect(aldiNames.filter(n => n === 'pasta')).toHaveLength(1)
  })

  it('tracks meals for each ingredient', () => {
    const slots = [
      { day: 'monday', type: 'recipe', recipeId: 'r1' },
      { day: 'tuesday', type: 'recipe', recipeId: 'r2' },
    ]
    const result = generateGroceryList(slots, RECIPES, [])
    const pasta = result.aldi.find(i => i.name === 'pasta')
    expect(pasta.meals).toEqual(expect.arrayContaining(['Pasta Bolognese', 'Chicken Stir Fry']))
    const beef = result.sams_club.find(i => i.name === 'ground beef')
    expect(beef.meals).toEqual(['Pasta Bolognese'])
  })

  it('skips eating_out and flex slots', () => {
    const slots = [
      { day: 'monday', type: 'eating_out' },
      { day: 'tuesday', type: 'flex' },
    ]
    const result = generateGroceryList(slots, RECIPES, [])
    expect(result.sams_club).toEqual([])
    expect(result.aldi).toEqual([])
    expect(result.target).toEqual([])
  })

  it('always includes staples marked as isStaple: true', () => {
    const slots = []
    const result = generateGroceryList(slots, RECIPES, STAPLES)
    expect(result.sams_club).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'yogurt', isStaple: true, isExtra: false, notes: 'check if running low' }),
    ]))
    expect(result.aldi).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'fruit', isStaple: true, isExtra: false, notes: null }),
    ]))
  })

  it('includes both recipe ingredients and staples together', () => {
    const slots = [
      { day: 'monday', type: 'recipe', recipeId: 'r1' },
    ]
    const result = generateGroceryList(slots, RECIPES, STAPLES)
    expect(result.sams_club).toHaveLength(2) // ground beef + yogurt
    expect(result.aldi).toHaveLength(2) // pasta + fruit
  })

  it('returns empty store arrays when nothing is planned and no staples', () => {
    const result = generateGroceryList([], [], [])
    expect(result).toEqual({ sams_club: [], aldi: [], target: [] })
  })

  it('appends extras into their store bucket with isExtra: true and id', () => {
    const extras = [
      { id: 'e1', name: 'Paper towels', store: 'sams_club' },
    ]
    const result = generateGroceryList([], [], [], extras)
    expect(result.sams_club).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Paper towels', isExtra: true, id: 'e1', isStaple: false }),
      ])
    )
  })

  it('creates store bucket dynamically if store key is missing (e.g. "other")', () => {
    const extras = [{ id: 'e2', name: 'Specialty sauce', store: 'other' }]
    const result = generateGroceryList([], [], [], extras)
    expect(result.other).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Specialty sauce', isExtra: true, id: 'e2' }),
      ])
    )
  })

  it('extras coexist in the same store bucket as recipe ingredients', () => {
    const slots = [{ day: 'monday', type: 'recipe', recipeId: 'r1' }]
    const extras = [{ id: 'e1', name: 'Paper towels', store: 'sams_club' }]
    const result = generateGroceryList(slots, RECIPES, [], extras)
    expect(result.sams_club).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'ground beef', isExtra: false }),
        expect.objectContaining({ name: 'Paper towels', isExtra: true, id: 'e1' }),
      ])
    )
  })
})

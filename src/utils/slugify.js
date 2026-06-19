export function slugify(label, existingValues = []) {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/\s/g, '_')
    .replace(/[^a-z0-9_]/g, '')

  if (!existingValues.includes(base)) return base

  let i = 2
  while (existingValues.includes(`${base}_${i}`)) i++
  return `${base}_${i}`
}

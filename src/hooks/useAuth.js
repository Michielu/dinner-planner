const KEY = 'dinner_planner_email'

export function useAuth() {
  const email = localStorage.getItem(KEY) ?? null

  function signIn(e) {
    localStorage.setItem(KEY, e)
  }

  function signOut() {
    localStorage.removeItem(KEY)
    window.location.href = '/login'
  }

  return { email, signIn, signOut }
}

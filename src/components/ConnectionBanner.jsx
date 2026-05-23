import { useState, useEffect } from 'react'

export function ConnectionBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const goOffline = () => setOffline(true)
    const goOnline = () => setOffline(false)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  if (!offline) return null

  return (
    <div className="fixed top-0 inset-x-0 z-50 bg-grain-sand text-soil-shadow text-sm text-center py-2 font-bold">
      Reconnecting… changes won't be saved until you're back online.
    </div>
  )
}

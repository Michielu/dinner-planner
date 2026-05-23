import { useEffect, useState, useCallback } from 'react'

export function Toast({ message, type = 'error', onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000)
    return () => clearTimeout(t)
  }, [onDismiss])

  const bg = type === 'error' ? 'bg-red-500' : 'bg-fresh-herb'
  const textColor = type === 'error' ? 'text-white' : 'text-soil-shadow'

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${bg} ${textColor} px-5 py-3 rounded-pill shadow-card flex items-center gap-3 max-w-sm`}>
      <span className="flex-1 text-sm font-bold">{message}</span>
      <button onClick={onDismiss} className="opacity-70 hover:opacity-100 text-lg leading-none">&times;</button>
    </div>
  )
}

export function useToast() {
  const [toast, setToast] = useState(null)

  const showToast = useCallback((message, type = 'error') => {
    setToast({ message, type })
  }, [])

  const dismissToast = useCallback(() => setToast(null), [])

  return { toast, showToast, dismissToast }
}

"use client"

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react"

interface Toast {
  id: number
  message: string
  leaving: boolean
}

interface ToastContextValue {
  showToast: (message: string) => void
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
})

let nextId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const removeToast = useCallback((id: number) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))
    )
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 200)
  }, [])

  const showToast = useCallback(
    (message: string) => {
      const id = nextId++
      setToasts((prev) => [...prev, { id, message, leaving: false }])
      const timer = setTimeout(() => removeToast(id), 2200)
      timers.current.set(id, timer)
    },
    [removeToast]
  )

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-4 inset-x-4 sm:bottom-5 sm:inset-x-auto sm:right-5 sm:left-auto z-50 flex flex-col gap-2 items-stretch sm:items-end pointer-events-none"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`
                pointer-events-auto flex items-center gap-2 rounded-lg px-4 py-2.5
                text-sm font-medium shadow-lg
                ${toast.leaving ? "toast-out" : "toast-in"}
              `}
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border-2)",
                color: "var(--text)",
              }}
            >
              <svg
                className="h-3.5 w-3.5 shrink-0"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M13.5 4.5L6.5 11.5L3 8"
                  stroke="var(--green)"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {toast.message}
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}

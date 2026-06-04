"use client"

import { useState } from "react"
import { useToast } from "./ToastContext"

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function plusDaysStr(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function Spinner() {
  return (
    <svg className="spinner h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="block text-xs font-medium tracking-wider uppercase mb-1.5"
      style={{ color: "var(--text-muted)" }}
    >
      {children}
    </label>
  )
}

const baseInput: React.CSSProperties = {
  display: "block",
  width: "100%",
  background: "var(--input)",
  border: "1px solid var(--border-strong)",
  borderRadius: "8px",
  padding: "8px 12px",
  fontSize: "16px",
  color: "var(--text)",
  outline: "none",
  transition: "border-color 0.15s",
}

function DateInput({
  value,
  onChange,
  required,
}: {
  value: string
  onChange: (v: string) => void
  required?: boolean
}) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      style={baseInput}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = "var(--accent)"
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = "var(--border-strong)"
      }}
    />
  )
}

function TimeInput({
  value,
  onChange,
  required,
}: {
  value: string
  onChange: (v: string) => void
  required?: boolean
}) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      style={baseInput}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = "var(--accent)"
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = "var(--border-strong)"
      }}
    />
  )
}

const LIMIT_OPTIONS = [3, 5, 7, 10] as const
type LimitOption = (typeof LIMIT_OPTIONS)[number]

export function AvailabilityForm() {
  const [startDate, setStartDate] = useState(todayStr)
  const [endDate, setEndDate] = useState(() => plusDaysStr(6))
  const [startTime, setStartTime] = useState("09:00")
  const [endTime, setEndTime] = useState("17:00")
  const [limitEnabled, setLimitEnabled] = useState(false)
  const [limitCount, setLimitCount] = useState<LimitOption>(5)
  const [result, setResult] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const { showToast } = useToast()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    setResult("")

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const params = new URLSearchParams({ startDate, endDate, startTime, endTime, timezone })
    if (limitEnabled) params.set("limit", String(limitCount))

    try {
      const res = await fetch(`/api/calendar/availability?${params}`)
      let data: { error?: string; availability?: string } = {}
      try {
        data = await res.json()
      } catch {
        // response wasn't JSON (e.g. server crash returned HTML)
      }

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.")
      } else {
        setResult(data.availability || "No availability found for the selected range.")
      }
    } catch {
      setError("Failed to fetch availability. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!result) return
    await navigator.clipboard.writeText(result)
    showToast("Copied to clipboard")
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Date range */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Start date</Label>
            <DateInput value={startDate} onChange={setStartDate} required />
          </div>
          <div>
            <Label>End date</Label>
            <DateInput value={endDate} onChange={setEndDate} required />
          </div>
        </div>

        {/* Time window */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Day starts</Label>
            <TimeInput value={startTime} onChange={setStartTime} required />
          </div>
          <div>
            <Label>Day ends</Label>
            <TimeInput value={endTime} onChange={setEndTime} required />
          </div>
        </div>

        {/* Limit toggle row */}
        <div className="flex items-center gap-3">
          {/* Toggle switch */}
          <button
            type="button"
            role="switch"
            aria-checked={limitEnabled}
            onClick={() => setLimitEnabled((v) => !v)}
            className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200"
            style={{
              background: limitEnabled ? "var(--accent)" : "var(--border-strong)",
            }}
          >
            <span
              className="pointer-events-none inline-block h-4 w-4 rounded-full transition-transform duration-200"
              style={{
                background: "#fff",
                margin: "2px",
                transform: limitEnabled ? "translateX(16px)" : "translateX(0)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
              }}
            />
          </button>

          <span
            className="text-sm select-none cursor-pointer"
            style={{ color: limitEnabled ? "var(--text)" : "var(--text-muted)" }}
            onClick={() => setLimitEnabled((v) => !v)}
          >
            Limit time slots
          </span>

          {/* Slot count dropdown */}
          {limitEnabled && (
            <select
              value={limitCount}
              onChange={(e) => setLimitCount(Number(e.target.value) as LimitOption)}
              className="rounded-md text-sm transition-colors"
              style={{
                background: "var(--input)",
                border: "1px solid var(--border-strong)",
                color: "var(--text)",
                padding: "3px 8px",
                outline: "none",
                cursor: "pointer",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--accent)"
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--border-strong)"
              }}
            >
              {LIMIT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} slots
                </option>
              ))}
            </select>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors"
          style={{
            background: loading ? "var(--accent-hover)" : "var(--accent)",
            color: "#fff",
            opacity: loading ? 0.75 : 1,
            cursor: loading ? "not-allowed" : "pointer",
          }}
          onMouseEnter={(e) => {
            if (!loading) e.currentTarget.style.background = "var(--accent-hover)"
          }}
          onMouseLeave={(e) => {
            if (!loading) e.currentTarget.style.background = "var(--accent)"
          }}
        >
          {loading && <Spinner />}
          {loading ? "Checking calendar…" : "Generate Availability"}
        </button>
      </form>

      {error && (
        <p className="text-sm" style={{ color: "var(--red)" }}>
          {error}
        </p>
      )}

      {result && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span
              className="text-xs font-medium tracking-wider uppercase"
              style={{ color: "var(--text-muted)" }}
            >
              Your availability
            </span>
            <button
              onClick={handleCopy}
              type="button"
              className="text-xs font-medium transition-colors"
              style={{ color: "var(--accent)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--accent-hover)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--accent)"
              }}
            >
              Copy to clipboard
            </button>
          </div>
          <pre
            className="rounded-lg p-4 text-sm leading-relaxed overflow-x-auto whitespace-pre-wrap"
            style={{
              background: "var(--input)",
              border: "1px solid var(--border-strong)",
              color: "var(--text)",
              fontFamily: "var(--font-geist-mono), monospace",
            }}
          >
            {result}
          </pre>
        </div>
      )}
    </div>
  )
}

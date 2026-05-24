"use client"

import { useState } from "react"
import type { TimeSlot } from "@/app/api/parse-match/route"
import { useToast } from "./ToastContext"

interface ParseResult {
  meetingType: string
  estimatedDurationMinutes: number
  reasoning: string
  bestMatch: TimeSlot | null
  alternatives: TimeSlot[]
  noMatchFound: boolean
}

function Spinner() {
  return (
    <svg className="spinner h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function getCopyText(slot: TimeSlot): string {
  return `Hey! ${slot.displayText} works great for me. Looking forward to it!`
}

function SlotCard({
  slot,
  highlight,
}: {
  slot: TimeSlot
  highlight?: boolean
}) {
  const { showToast } = useToast()

  async function handleCopy() {
    await navigator.clipboard.writeText(getCopyText(slot))
    showToast("Response copied!")
  }

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: highlight ? "var(--green-bg)" : "var(--input)",
        border: `1px solid ${highlight ? "var(--green-border)" : "var(--border-strong)"}`,
      }}
    >
      {highlight && (
        <p
          className="text-xs font-semibold tracking-wider uppercase mb-2"
          style={{ color: "var(--green)" }}
        >
          Best match — you&apos;re free
        </p>
      )}
      <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
        {slot.displayText}
      </p>
      <p
        className="mt-2 text-xs leading-relaxed rounded-lg px-3 py-2"
        style={{
          background: highlight ? "rgba(0,0,0,0.2)" : "var(--card)",
          color: "var(--text-muted)",
          fontFamily: "var(--font-geist-mono), monospace",
          border: "1px solid var(--border)",
        }}
      >
        {getCopyText(slot)}
      </p>
      <button
        onClick={handleCopy}
        type="button"
        className="mt-2 flex items-center gap-1.5 text-xs font-medium transition-colors"
        style={{ color: "var(--accent)" }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-hover)" }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--accent)" }}
      >
        <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" stroke="currentColor" strokeWidth="1.4" />
        </svg>
        Copy response
      </button>
    </div>
  )
}

export function ParseMatch() {
  const [emailText, setEmailText] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ParseResult | null>(null)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    setResult(null)

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

    try {
      const res = await fetch("/api/parse-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailText, timezone }),
      })

      let data: Record<string, unknown>
      try {
        data = await res.json()
      } catch {
        setError(
          `Server returned an unexpected response (HTTP ${res.status}). Check the terminal for details.`
        )
        return
      }

      if (!res.ok) {
        setError((data.error as string) ?? "Something went wrong.")
      } else {
        setResult(data as unknown as ParseResult)
      }
    } catch (err) {
      setError(`Network error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            className="block text-xs font-medium tracking-wider uppercase mb-1.5"
            style={{ color: "var(--text-muted)" }}
          >
            Email or message
          </label>
          <textarea
            value={emailText}
            onChange={(e) => setEmailText(e.target.value)}
            placeholder="Hey! Are you free for dinner this Saturday or Sunday evening? Would love to catch up!"
            required
            rows={5}
            className="w-full rounded-lg px-3 py-2.5 text-sm leading-relaxed resize-none transition-colors"
            style={{
              background: "var(--input)",
              border: "1px solid var(--border-strong)",
              color: "var(--text)",
              outline: "none",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--accent)"
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--border-strong)"
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading || !emailText.trim()}
          className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors"
          style={{
            background: "var(--accent)",
            color: "#fff",
            opacity: loading || !emailText.trim() ? 0.5 : 1,
            cursor: loading || !emailText.trim() ? "not-allowed" : "pointer",
          }}
          onMouseEnter={(e) => {
            if (!loading && emailText.trim())
              e.currentTarget.style.background = "var(--accent-hover)"
          }}
          onMouseLeave={(e) => {
            if (!loading && emailText.trim())
              e.currentTarget.style.background = "var(--accent)"
          }}
        >
          {loading && <Spinner />}
          {loading ? "Analyzing…" : "Find Best Time"}
        </button>
      </form>

      {error && (
        <p className="text-sm" style={{ color: "var(--red)" }}>
          {error}
        </p>
      )}

      {result && (
        <div className="space-y-3 pt-1">
          {/* Meeting type + reasoning */}
          <div
            className="rounded-xl p-4"
            style={{
              background: "var(--input)",
              border: "1px solid var(--border-strong)",
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span
                className="rounded-md px-2 py-0.5 text-xs font-semibold capitalize"
                style={{
                  background: "rgba(59,130,246,0.15)",
                  color: "var(--accent)",
                  border: "1px solid rgba(59,130,246,0.25)",
                }}
              >
                {result.meetingType}
              </span>
              <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                ~{result.estimatedDurationMinutes} min
              </span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {result.reasoning}
            </p>
          </div>

          {/* No free slot warning */}
          {!result.bestMatch && (
            <div
              className="rounded-xl px-4 py-3"
              style={{
                background: "var(--amber-bg)",
                border: "1px solid var(--amber-border)",
              }}
            >
              <p className="text-sm font-medium" style={{ color: "var(--amber)" }}>
                None of the proposed times are free on your calendar.
              </p>
              {result.alternatives.length > 0 && (
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  Here are the closest free slots:
                </p>
              )}
            </div>
          )}

          {/* Best match */}
          {result.bestMatch && (
            <SlotCard slot={result.bestMatch} highlight />
          )}

          {/* Alternatives */}
          {result.alternatives.length > 0 && (
            <div>
              <p
                className="text-xs font-medium tracking-wider uppercase mb-2"
                style={{ color: "var(--text-dim)" }}
              >
                {result.bestMatch ? "Other times you're free" : "Closest alternatives"}
              </p>
              <div className="space-y-2">
                {result.alternatives.map((slot, i) => (
                  <SlotCard key={i} slot={slot} />
                ))}
              </div>
            </div>
          )}

          {result.noMatchFound && result.alternatives.length === 0 && (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No free alternatives found in the next two weeks. Try generating
              your availability to share open times.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

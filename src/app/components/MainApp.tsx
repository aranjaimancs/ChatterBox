"use client"

import { useEffect, useRef, useState } from "react"
import { signOut } from "next-auth/react"
import { AvailabilityForm } from "./AvailabilityForm"
import { ParseMatch } from "./ParseMatch"

type Tab = "availability" | "parse-match"

interface Props {
  userEmail: string
}

export function MainApp({ userEmail }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("availability")
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const avatar = (userEmail[0] ?? "?").toUpperCase()

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [menuOpen])

  return (
    <div className="w-full max-w-lg">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <span
          className="text-lg font-bold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          Chatter<span style={{ color: "var(--accent)" }}>Box</span>
        </span>

        {/* Avatar + dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-opacity hover:opacity-80"
            style={{
              background: "#1e1e1e",
              border: "1px solid var(--border-strong)",
              color: "var(--text-muted)",
            }}
            title={userEmail}
            aria-label="Account menu"
          >
            {avatar}
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-10 w-52 rounded-xl py-1 z-10"
              style={{
                background: "#1a1a1a",
                border: "1px solid var(--border-strong)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
              }}
            >
              <div
                className="px-3 py-2 text-xs truncate"
                style={{ color: "var(--text-muted)" }}
              >
                {userEmail}
              </div>
              <div
                className="mx-2 my-1"
                style={{ borderTop: "1px solid var(--border)" }}
              />
              <button
                type="button"
                onClick={() => signOut()}
                className="w-full px-3 py-2 text-left text-sm transition-colors"
                style={{ color: "var(--text)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#222222"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent"
                }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Card */}
      <div
        className="rounded-2xl"
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
        }}
      >
        {/* Tabs */}
        <div
          className="flex"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          {(
            [
              { id: "availability", label: "Generate Availability" },
              { id: "parse-match", label: "Parse & Match" },
            ] as { id: Tab; label: string }[]
          ).map(({ id, label }) => {
            const isActive = activeTab === id
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                type="button"
                className="px-5 py-3.5 text-sm font-medium transition-colors relative"
                style={{
                  color: isActive ? "var(--text)" : "var(--text-muted)",
                  borderBottom: isActive
                    ? "2px solid var(--accent)"
                    : "2px solid transparent",
                  marginBottom: "-1px",
                  background: "transparent",
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === "availability" ? <AvailabilityForm /> : <ParseMatch />}
        </div>
      </div>
    </div>
  )
}

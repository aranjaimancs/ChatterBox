import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Privacy Policy — Slottd",
  description: "Privacy policy for Slottd",
}

export default function PrivacyPage() {
  return (
    <main
      className="min-h-screen px-6 py-16"
      style={{ background: "var(--bg)" }}
    >
      <div className="max-w-2xl mx-auto">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm mb-10 transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Slottd
        </Link>

        {/* Header */}
        <h1
          className="text-3xl font-bold tracking-tight mb-2"
          style={{ color: "var(--text)" }}
        >
          Privacy Policy
        </h1>
        <p className="text-sm mb-10" style={{ color: "var(--text-muted)" }}>
          Last updated: May 24, 2025
        </p>

        <div className="space-y-8" style={{ color: "var(--text-muted)" }}>
          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: "var(--text)" }}>
              Overview
            </h2>
            <p className="text-sm leading-relaxed">
              Slottd is a scheduling assistant that connects to your Google Calendar to help
              you share your availability and find meeting times. This policy explains what
              data we access, how we use it, and what we never do with it.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: "var(--text)" }}>
              What data we access
            </h2>
            <p className="text-sm leading-relaxed mb-3">
              When you sign in with Google, Slottd requests read-only access to your Google
              Calendar. Specifically, we access:
            </p>
            <ul className="text-sm leading-relaxed space-y-1.5 list-none">
              {[
                "Your calendar event times and busy/free status",
                "Your calendar list (to check all calendars for conflicts)",
                "Your Google account email address (for display purposes only)",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "var(--accent)" }} />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: "var(--text)" }}>
              How we use your data
            </h2>
            <p className="text-sm leading-relaxed mb-3">
              Your calendar data is used solely to power two features:
            </p>
            <ul className="text-sm leading-relaxed space-y-1.5 list-none">
              {[
                "Generate Availability — reads your calendar to identify free time blocks you can share with others.",
                "Parse & Match — compares proposed meeting times from an email against your calendar to find the best open slot.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "var(--accent)" }} />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: "var(--text)" }}>
              What we do NOT do
            </h2>
            <ul className="text-sm leading-relaxed space-y-1.5 list-none">
              {[
                "We do not store your calendar events or any calendar data on our servers.",
                "We do not share your data with third parties.",
                "We do not use your data for advertising or analytics.",
                "We do not read the content or titles of your calendar events — only their times.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "var(--accent)" }} />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: "var(--text)" }}>
              Data storage
            </h2>
            <p className="text-sm leading-relaxed">
              Slottd does not maintain a database. Calendar data is fetched on demand when
              you use a feature and is never written to disk or retained between requests.
              Your Google OAuth tokens are stored in an encrypted session cookie in your
              browser only, and are used solely to authenticate requests to Google Calendar
              on your behalf.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: "var(--text)" }}>
              Third-party services
            </h2>
            <p className="text-sm leading-relaxed">
              Slottd uses the following third-party services:
            </p>
            <ul className="text-sm leading-relaxed space-y-1.5 list-none mt-3">
              {[
                "Google OAuth 2.0 — for authentication and calendar access.",
                "OpenAI API — to parse meeting proposals from email text. Only the email text you paste is sent; no calendar data is transmitted to OpenAI.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "var(--accent)" }} />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: "var(--text)" }}>
              Revoking access
            </h2>
            <p className="text-sm leading-relaxed">
              You can revoke Slottd&apos;s access to your Google account at any time by
              visiting{" "}
              <span style={{ color: "var(--accent)" }}>myaccount.google.com/permissions</span>
              {" "}and removing Slottd from the list of connected apps.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: "var(--text)" }}>
              Contact
            </h2>
            <p className="text-sm leading-relaxed">
              If you have any questions about this privacy policy, please reach out at{" "}
              <span style={{ color: "var(--accent)" }}>slottd.app@gmail.com</span>.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}

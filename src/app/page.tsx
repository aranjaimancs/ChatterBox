import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { SignInButton } from "./components/SignInButton"
import { MainApp } from "./components/MainApp"
import Link from "next/link"

export default async function Home() {
  const session = await getServerSession(authOptions)

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-4 py-8 sm:py-16"
      style={{ background: "var(--bg)" }}
    >
      {session ? (
        <MainApp userEmail={session.user?.email ?? ""} />
      ) : (
        <div className="flex flex-col items-center text-center max-w-sm w-full">
          <h1 className="text-4xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
            Slott<span style={{ color: "var(--accent)" }}>d</span>
          </h1>
          <p
            className="mt-3 text-sm leading-relaxed"
            style={{ color: "var(--text-muted)" }}
          >
            Paste an email, get the perfect time slot — no back-and-forth.
          </p>
          <SignInButton />
          <p className="mt-4 text-xs" style={{ color: "var(--text-dim)" }}>
            Read-only access · No calendar data stored
          </p>
          <p className="mt-3 text-xs" style={{ color: "var(--text-dim)" }}>
            <Link
              href="/privacy"
              style={{ color: "var(--text-dim)" }}
              className="underline underline-offset-2 hover:opacity-70 transition-opacity"
            >
              Privacy Policy
            </Link>
          </p>
        </div>
      )}
    </main>
  )
}

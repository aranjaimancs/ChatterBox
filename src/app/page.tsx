import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { SignInButton } from "./components/SignInButton"
import { MainApp } from "./components/MainApp"

export default async function Home() {
  const session = await getServerSession(authOptions)

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-4 py-16"
      style={{ background: "var(--bg)" }}
    >
      {session ? (
        <MainApp userEmail={session.user?.email ?? ""} />
      ) : (
        <div className="flex flex-col items-center text-center max-w-sm w-full">
          <h1 className="text-4xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
            Chatter<span style={{ color: "var(--accent)" }}>Box</span>
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
        </div>
      )}
    </main>
  )
}

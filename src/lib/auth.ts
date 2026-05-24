import type { NextAuthOptions } from "next-auth"
import type { JWT } from "next-auth/jwt"
import GoogleProvider from "next-auth/providers/google"

async function refreshAccessToken(token: JWT): Promise<JWT> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: token.refreshToken!,
    }),
  })

  const refreshed = await response.json()

  if (!response.ok) {
    throw new Error(refreshed.error ?? "Failed to refresh token")
  }

  return {
    ...token,
    accessToken: refreshed.access_token,
    expiresAt: Math.floor(Date.now() / 1000) + (refreshed.expires_in as number),
    // Google only returns a new refresh_token if the old one is consumed
    refreshToken: refreshed.refresh_token ?? token.refreshToken,
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/calendar.readonly",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // First sign-in: store tokens from Google
      if (account) {
        return {
          ...token,
          accessToken: account.access_token ?? undefined,
          refreshToken: account.refresh_token ?? undefined,
          expiresAt:
            typeof account.expires_at === "number"
              ? account.expires_at
              : undefined,
        }
      }

      // Token still valid (with 60s buffer)
      if (token.expiresAt && Date.now() / 1000 < token.expiresAt - 60) {
        return token
      }

      // Token expired — refresh it
      if (!token.refreshToken) return token

      try {
        return await refreshAccessToken(token)
      } catch (err) {
        console.error("Failed to refresh access token:", err)
        // Return token as-is; the API call will fail and the user will need to re-auth
        return token
      }
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken
      return session
    },
  },
}

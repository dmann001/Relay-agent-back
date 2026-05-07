"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { storage } from "@/lib/storage"

type User = any

type Session = {
  user: User | null
} | null

type AuthContextValue = {
  session: Session | null
  user: User | null
  isLoading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const PUBLIC_ROUTES = new Set(["/", "/login", "/demo"])

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const loadSession = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (!isMounted) return
      if (error) {
        console.error("[Auth] Failed to load session:", error)
      }
      setSession(data.session ?? null)
      setIsLoading(false)
    }

    loadSession()

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession)
        setIsLoading(false)
      }
    )

    return () => {
      isMounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (isLoading) return
    const isPublicRoute = PUBLIC_ROUTES.has(pathname)

    if (!session && !isPublicRoute) {
      router.replace("/login")
      return
    }

    if (session && isPublicRoute) {
      router.replace("/inbox")
    }
  }, [isLoading, pathname, router, session])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      signOut: async () => {
        const { error } = await supabase.auth.signOut()
        if (error) {
          console.error("[Auth] Sign out failed:", error)
          return
        }
        storage.clear()
        router.replace("/login")
      },
    }),
    [isLoading, router, session]
  )

  if (isLoading && !PUBLIC_ROUTES.has(pathname)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading session...</div>
      </div>
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return ctx
}

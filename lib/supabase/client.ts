import { createClient } from "@supabase/supabase-js"

type AuthStoragePreference = "session"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const disabledAuthError = {
  message: "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  status: 503,
}

const getSessionStorage = (): Storage | undefined => {
  if (typeof window === "undefined") return undefined
  return window.sessionStorage
}

const authStorage = {
  getItem: (key: string) => getSessionStorage()?.getItem(key) ?? null,
  setItem: (key: string, value: string) => {
    getSessionStorage()?.setItem(key, value)
  },
  removeItem: (key: string) => {
    getSessionStorage()?.removeItem(key)
  },
}

const disabledSupabase = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: (_callback: (event: string, session: any) => void) => ({
      data: { subscription: { unsubscribe: () => {} } },
    }),
    signOut: async () => ({ error: disabledAuthError }),
    signInWithPassword: async () => ({ error: disabledAuthError }),
    signUp: async () => ({ data: { session: null }, error: disabledAuthError }),
    signInWithOAuth: async () => ({ error: disabledAuthError }),
  },
  from: (_table: string) => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: disabledAuthError }) }) }),
    insert: async () => ({ error: disabledAuthError }),
    upsert: async () => ({ error: disabledAuthError }),
    delete: () => ({ eq: async () => ({ error: disabledAuthError }) }),
  }),
}

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: true,
          persistSession: true,
          storage: authStorage,
        },
      })
    : (disabledSupabase as any)

export const getAuthStoragePreference = (): AuthStoragePreference => "session"

export const setAuthStoragePreference = (_rememberMe: boolean) => {
  // App data is stored in Supabase. Auth session persistence is intentionally
  // limited to sessionStorage so Relay does not keep app state in localStorage.
}

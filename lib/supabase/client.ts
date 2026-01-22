import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables for client auth")
}

const AUTH_STORAGE_PREFERENCE_KEY = "relay_auth_storage"

export const getAuthStoragePreference = (): "local" | "session" => {
  if (typeof window === "undefined") return "local"
  const preference = window.localStorage.getItem(AUTH_STORAGE_PREFERENCE_KEY)
  return preference === "session" ? "session" : "local"
}

const getPreferredStorage = (): Storage | undefined => {
  if (typeof window === "undefined") return undefined
  const preference = getAuthStoragePreference()
  return preference === "session" ? window.sessionStorage : window.localStorage
}

const authStorage = {
  getItem: (key: string) => {
    const storage = getPreferredStorage()
    return storage ? storage.getItem(key) : null
  },
  setItem: (key: string, value: string) => {
    const storage = getPreferredStorage()
    if (!storage) return
    storage.setItem(key, value)
  },
  removeItem: (key: string) => {
    if (typeof window === "undefined") return
    window.localStorage.removeItem(key)
    window.sessionStorage.removeItem(key)
  },
}

export const setAuthStoragePreference = (rememberMe: boolean) => {
  if (typeof window === "undefined") return
  window.localStorage.setItem(
    AUTH_STORAGE_PREFERENCE_KEY,
    rememberMe ? "local" : "session"
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: authStorage,
  },
})

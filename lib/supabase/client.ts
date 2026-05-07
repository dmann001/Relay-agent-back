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

const noAuthError = { message: "Supabase auth disabled in this build", status: 503 }

export const setAuthStoragePreference = (rememberMe: boolean) => {
  if (typeof window === "undefined") return
  window.localStorage.setItem(
    AUTH_STORAGE_PREFERENCE_KEY,
    rememberMe ? "local" : "session"
  )
}

export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: (_callback: (event: string, session: any) => void) => ({
      data: { subscription: { unsubscribe: () => {} } },
    }),
    signOut: async () => ({ error: noAuthError }),
    signInWithPassword: async () => ({ error: noAuthError }),
    signUp: async () => ({ data: { session: null }, error: noAuthError }),
    signInWithOAuth: async () => ({ error: noAuthError }),
    setAuthCookie: async () => ({ error: noAuthError }),
  },
  storage: authStorage,
}

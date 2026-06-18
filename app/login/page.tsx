import { Suspense } from "react"
import LoginPage from "./login-form"

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--landing-bg)]">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900 dark:border-neutral-700 dark:border-t-neutral-100" />
        </div>
      }
    >
      <LoginPage />
    </Suspense>
  )
}

import { Suspense } from "react"
import LoginPage from "./login-form"

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="landing-page flex min-h-screen items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-700 border-t-neutral-100" />
        </div>
      }
    >
      <LoginPage />
    </Suspense>
  )
}

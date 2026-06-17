import { Suspense } from "react"
import { ConnectionsSettings } from "@/components/settings/connections-settings"

export default function ConnectionsSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Loading connections...
        </div>
      }
    >
      <ConnectionsSettings />
    </Suspense>
  )
}

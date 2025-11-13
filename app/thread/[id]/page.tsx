import { AppSidebar } from "@/components/app-sidebar"
import { ThreadView } from "@/components/thread-view"

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />
      <ThreadView threadId={id} />
    </div>
  )
}

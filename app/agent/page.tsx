import { AppSidebar } from "@/components/app-sidebar"
import { SearchBar } from "@/components/search-bar"
import { AgentActions } from "@/components/agent-actions"

export default function AgentPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar />
      <div className="flex flex-1 flex-col">
        <SearchBar />
        <div className="flex flex-1 overflow-hidden">
          <AgentActions />
        </div>
      </div>
    </div>
  )
}

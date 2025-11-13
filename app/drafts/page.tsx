import { AppSidebar } from "@/components/app-sidebar"
import { SearchBar } from "@/components/search-bar"
import { DraftsList } from "@/components/drafts-list"

export default function DraftsPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar />
      <div className="flex flex-1 flex-col">
        <SearchBar />
        <div className="flex flex-1 overflow-hidden">
          <DraftsList />
        </div>
      </div>
    </div>
  )
}

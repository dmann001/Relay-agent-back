import { AppSidebar } from "@/components/app-sidebar"
import { SearchBar } from "@/components/search-bar"
import { ArchivesList } from "@/components/archives-list"

export default function ArchivesPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar />
      <div className="flex flex-1 flex-col">
        <SearchBar />
        <div className="flex flex-1 overflow-hidden">
          <ArchivesList />
        </div>
      </div>
    </div>
  )
}

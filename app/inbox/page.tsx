import { AppSidebar } from "@/components/app-sidebar"
import { InboxList } from "@/components/inbox-list"
import { SearchBar } from "@/components/search-bar"

export default function InboxPage() {
  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />
      <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
        <div className="border-b border-border bg-background px-6 py-5">
          <SearchBar />
        </div>
        <div className="flex-1 min-h-0">
          <InboxList />
        </div>
      </div>
    </div>
  )
}

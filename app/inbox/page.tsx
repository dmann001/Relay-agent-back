import { AppSidebar } from "@/components/app-sidebar"
import { InboxList } from "@/components/inbox-list"
import { SearchBar } from "@/components/search-bar"

export default function InboxPage() {
  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />
      <div className="flex flex-1 flex-col">
        <div className="border-b border-border bg-background px-6 py-4">
          <SearchBar />
        </div>
        <InboxList />
      </div>
    </div>
  )
}

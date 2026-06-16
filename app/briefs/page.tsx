import { AppSidebar } from "@/components/app-sidebar"
import { MeetingBriefsContent } from "@/components/meeting-briefs-content"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"

export default function BriefsPage() {
  return <div className="flex h-screen overflow-hidden bg-background text-foreground">
    <div className="hidden lg:flex"><AppSidebar /></div>
    <div className="relative z-10 min-w-0 flex-1 pb-16 lg:pb-0"><MeetingBriefsContent /></div>
    <MobileBottomNav />
  </div>
}

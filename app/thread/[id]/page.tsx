import { AppSidebar } from "@/components/app-sidebar";
import { ThreadView } from "@/components/thread-view";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";

export default async function ThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ account?: string }>;
}) {
  const { id } = await params;
  const { account } = await searchParams;

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Noise Texture Overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.015] z-50"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Ambient Gradient Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-[500px] h-[500px] rounded-full blur-[150px] opacity-15"
          style={{
            background: "radial-gradient(circle, #E8DCC4 0%, transparent 70%)",
            top: "5%",
            right: "15%",
          }}
        />
        <div
          className="absolute w-[350px] h-[350px] rounded-full blur-[120px] opacity-10"
          style={{
            background: "radial-gradient(circle, #C4A052 0%, transparent 70%)",
            bottom: "20%",
            left: "10%",
          }}
        />
      </div>

      <div className="hidden lg:flex">
        <AppSidebar />
      </div>
      <div className="relative z-10 min-w-0 flex-1 overflow-hidden pb-16 lg:pb-0">
        <ThreadView threadId={id} accountId={account} />
      </div>
      <MobileBottomNav />
    </div>
  );
}

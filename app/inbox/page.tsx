"use client"

import { useState, useEffect } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { InboxList } from "@/components/inbox-list"
import { RelayedHub } from "@/components/relayed"
import { storage } from "@/lib/storage"

export default function InboxPage() {
  const [isRelayedMode, setIsRelayedMode] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    setIsRelayedMode(storage.isRelayedMode())
    setIsLoaded(true)
  }, [])

  // Prevent flash of wrong content
  if (!isLoaded) {
    return (
      <div className="flex h-screen bg-[#0A0A0B]">
        <AppSidebar />
        <div className="flex flex-1 min-w-0 flex-col overflow-hidden items-center justify-center">
          <div className="animate-pulse text-[#8A8A8A]">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[#0A0A0B] text-[#FAFAF9]">
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
          className="absolute w-[600px] h-[600px] rounded-full blur-[150px] opacity-15"
          style={{
            background: 'radial-gradient(circle, #E8DCC4 0%, transparent 70%)',
            top: '-10%',
            right: '-5%',
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] rounded-full blur-[120px] opacity-10"
          style={{
            background: 'radial-gradient(circle, #C4A052 0%, transparent 70%)',
            bottom: '10%',
            left: '20%',
          }}
        />
      </div>

      <AppSidebar />
      <div className="relative z-10 flex flex-1 min-w-0 flex-col overflow-hidden">
        <div className="flex-1 min-h-0">
          {isRelayedMode ? <RelayedHub /> : <InboxList />}
        </div>
      </div>
    </div>
  )
}


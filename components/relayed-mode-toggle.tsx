"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { storage } from "@/lib/storage"
import { Zap, Inbox } from "lucide-react"

interface RelayedModeToggleProps {
  onChange?: (isRelayed: boolean) => void
  className?: string
}

export function RelayedModeToggle({ onChange, className }: RelayedModeToggleProps) {
  const [isRelayed, setIsRelayed] = useState(false)

  useEffect(() => {
    setIsRelayed(storage.isRelayedMode())
  }, [])

  const toggleMode = () => {
    const newMode = storage.toggleRelayedMode()
    setIsRelayed(newMode)
    onChange?.(newMode)
    // Trigger page refresh to show new mode
    window.location.reload()
  }

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={toggleMode}
        className={cn(
          "group relative flex h-10 w-full items-center justify-between rounded-lg px-3 transition-all duration-300",
          isRelayed
            ? "bg-gradient-to-r from-[#E8DCC4]/20 via-[#E8DCC4]/10 to-transparent border border-[#E8DCC4]/30"
            : "bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06]"
        )}
      >
        {/* Mode Label */}
        <div className="flex items-center gap-2">
          {isRelayed ? (
            <>
              <div className="relative">
                <Zap className="h-4 w-4 text-[#E8DCC4]" />
                <div className="absolute inset-0 animate-ping">
                  <Zap className="h-4 w-4 text-[#E8DCC4] opacity-30" />
                </div>
              </div>
              <span className="text-sm font-medium text-[#E8DCC4]">Relayed</span>
            </>
          ) : (
            <>
              <Inbox className="h-4 w-4 text-[#8A8A8A]" />
              <span className="text-sm font-medium text-[#8A8A8A]">Normal</span>
            </>
          )}
        </div>

        {/* Toggle Pill */}
        <div
          className={cn(
            "relative h-6 w-11 rounded-full transition-all duration-300",
            isRelayed
              ? "bg-gradient-to-r from-[#E8DCC4] to-[#C4A052] shadow-[0_0_10px_rgba(232,220,196,0.5)]"
              : "bg-white/[0.15]"
          )}
        >
          <div
            className={cn(
              "absolute top-1 h-4 w-4 rounded-full shadow-sm transition-all duration-300",
              isRelayed ? "left-6 bg-[#0A0A0B]" : "left-1 bg-white"
            )}
          />
        </div>
      </button>

      {/* Glow effect when relayed */}
      {isRelayed && (
        <div className="absolute inset-0 -z-10 rounded-lg bg-[#E8DCC4]/10 blur-xl" />
      )}
    </div>
  )
}

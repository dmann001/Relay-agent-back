"use client"

import { useEffect, useState } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function SearchBar({
  onSearch,
  isSearching,
}: {
  onSearch?: (query: string) => void
  isSearching?: boolean
}) {
  const [query, setQuery] = useState("")

  useEffect(() => {
    const id = setTimeout(() => onSearch?.(query), 350)
    return () => clearTimeout(id)
  }, [query, onSearch])

  return (
    <div className="relative">
      <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A8A8A]" />
      <Input
        type="search"
        placeholder="Search emails..."
        className="h-11 w-full max-w-md pl-11 pr-10 text-sm bg-white/[0.03] border-white/[0.08] text-[#FAFAF9] placeholder:text-[#5A5A5A] rounded-xl focus:border-[#E8DCC4]/30 focus:ring-1 focus:ring-[#E8DCC4]/20 backdrop-blur-xl"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            onSearch?.(query)
          }
        }}
        disabled={isSearching}
      />
      {query && !isSearching && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2 text-[#8A8A8A] hover:text-[#FAFAF9] hover:bg-white/[0.03]"
          onClick={() => setQuery("")}
          title="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
      {isSearching && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#E8DCC4] border-t-transparent" />
        </div>
      )}
    </div>
  )
}

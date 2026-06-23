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
      <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Search emails..."
        className="h-10 w-full max-w-md rounded-lg border-input bg-background pl-10 pr-10 text-[13px] text-foreground shadow-none placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring/20"
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
          className="absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
          onClick={() => setQuery("")}
          title="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
      {isSearching && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      )}
    </div>
  )
}

"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"

interface CommandInputProps {
  onSubmit: (command: string) => void
  isProcessing: boolean
  suggestions?: string[]
}

const defaultSuggestions = [
  "What needs my attention?",
  "Summarize my inbox",
  "Show decisions needed",
  "Find urgent emails",
  "Show meeting requests",
]

export function CommandInput({ onSubmit, isProcessing, suggestions = defaultSuggestions }: CommandInputProps) {
  const [input, setInput] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(true)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto"
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 140) + "px"
    }
  }, [input])

  const handleSubmit = () => {
    if (!input.trim() || isProcessing) return
    onSubmit(input.trim())
    setInput("")
    setShowSuggestions(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    onSubmit(suggestion)
    setShowSuggestions(false)
  }

  return (
    <div
      className="rounded-2xl border border-white/[0.06] px-4 py-4"
      style={{
        background: 'linear-gradient(180deg, rgba(20,20,22,0.9) 0%, rgba(10,10,11,0.95) 100%)',
        backdropFilter: 'blur(40px)',
      }}
    >
      {showSuggestions && !input && (
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#5A5A5A] mb-2">
            Suggested flows
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => handleSuggestionClick(suggestion)}
                disabled={isProcessing}
                className={cn(
                  "rounded-full border border-white/[0.08] px-3 py-1.5 text-[11px] uppercase tracking-[0.2em]",
                  "text-[#8A8A8A] hover:text-[#E8DCC4] hover:border-[#E8DCC4]/40 transition-colors bg-white/[0.02]",
                  isProcessing && "opacity-50 cursor-not-allowed"
                )}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-end gap-3">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          placeholder={isProcessing ? "Processing..." : "Tell Relayed what to do..."}
          disabled={isProcessing}
          rows={1}
          className={cn(
            "w-full resize-none bg-transparent py-2 text-sm leading-relaxed",
            "text-[#FAFAF9] placeholder:text-[#5A5A5A]",
            "focus:outline-none border-none ring-0",
            "scrollbar-none",
            isProcessing && "opacity-50 cursor-wait"
          )}
          spellCheck={false}
          autoComplete="off"
          autoFocus
        />
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || isProcessing}
          className={cn(
            "rounded-xl px-4 py-2 text-[11px] uppercase tracking-[0.2em] transition-all",
            "bg-gradient-to-b from-[#E8DCC4] to-[#C4A052] text-[#0A0A0B] font-medium hover:from-[#F5EDD8] hover:to-[#D4B062]",
            (!input.trim() || isProcessing) && "opacity-50 cursor-not-allowed"
          )}
        >
          Send
        </button>
      </div>
    </div>
  )
}


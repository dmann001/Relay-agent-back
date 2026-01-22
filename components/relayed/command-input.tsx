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
      className="rounded-2xl border border-white/[0.06] px-4 py-3 shadow-2xl"
      style={{
        background: '#0F0F10',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.03), 0 20px 40px -10px rgba(0,0,0,0.5)',
      }}
    >
      {showSuggestions && !input && (
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#5A5A5A] mb-2 font-mono">
            Suggested flows
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => handleSuggestionClick(suggestion)}
                disabled={isProcessing}
                className={cn(
                  "rounded-full border border-white/[0.08] px-3 py-1.5 text-[10px] uppercase tracking-[0.1em]",
                  "text-[#8A8A8A] hover:text-[#E8DCC4] hover:border-[#E8DCC4]/40 transition-colors bg-white/[0.02] font-mono",
                  isProcessing && "opacity-50 cursor-not-allowed"
                )}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          placeholder={isProcessing ? "Processing..." : "Schedule deep work session for Tuesday..."}
          disabled={isProcessing}
          rows={1}
          className={cn(
            "w-full resize-none bg-transparent py-3 text-sm leading-relaxed font-mono",
            "text-[#FAFAF9] placeholder:text-[#5A5A5A]/60",
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
            "h-8 w-8 shrink-0 rounded-lg flex items-center justify-center transition-all",
            "bg-[#E8DCC4] text-[#0A0A0B] hover:bg-[#F5EDD8]",
            (!input.trim() || isProcessing) && "opacity-50 cursor-not-allowed bg-[#2A2A2C] text-[#5A5A5A]"
          )}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8.00003 3.33331L12.6667 7.99998M12.6667 7.99998L8.00003 12.6666M12.6667 7.99998L3.33336 7.99998" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}


"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

function formatInline(text: string): ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  const parts = text.split(pattern).filter((part) => part.length > 0)

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**")) {
      return <em key={index}>{part.slice(1, -1)}</em>
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className="rounded bg-surface-subtle px-1 py-0.5 font-mono text-[0.85em] text-foreground">
          {part.slice(1, -1)}
        </code>
      )
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (linkMatch) {
      return (
        <a
          key={index}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-brand underline underline-offset-2 hover:text-brand-strong"
        >
          {linkMatch[1]}
        </a>
      )
    }
    return part
  })
}

function renderBlock(block: string, index: number) {
  const lines = block.split("\n")
  const imageMatch = block.trim().match(/^!\[([^\]]*)\]\((data:image\/[^)]+)\)$/)
  if (imageMatch) {
    return (
      <figure key={index} className="my-3">
        {/* Generated data URLs cannot be optimized by next/image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageMatch[2]}
          alt={imageMatch[1] || "Generated image"}
          className="max-h-[28rem] max-w-full rounded-lg border border-border object-contain"
        />
      </figure>
    )
  }
  const isBulletList = lines.every((line) => !line.trim() || /^[-*]\s+/.test(line.trim()))
  const isNumberedList = lines.every((line) => !line.trim() || /^\d+\.\s+/.test(line.trim()))

  if (isBulletList && lines.some((line) => /^[-*]\s+/.test(line.trim()))) {
    return (
      <ul key={index} className="my-2 list-disc space-y-1 pl-5">
        {lines.filter((line) => /^[-*]\s+/.test(line.trim())).map((line, lineIndex) => (
          <li key={lineIndex} className="leading-6">{formatInline(line.replace(/^[-*]\s+/, ""))}</li>
        ))}
      </ul>
    )
  }

  if (isNumberedList && lines.some((line) => /^\d+\.\s+/.test(line.trim()))) {
    return (
      <ol key={index} className="my-2 list-decimal space-y-1 pl-5">
        {lines.filter((line) => /^\d+\.\s+/.test(line.trim())).map((line, lineIndex) => (
          <li key={lineIndex} className="leading-6">{formatInline(line.replace(/^\d+\.\s+/, ""))}</li>
        ))}
      </ol>
    )
  }

  return (
    <p key={index} className="leading-6">
      {lines.map((line, lineIndex) => (
        <span key={lineIndex}>
          {lineIndex > 0 && <br />}
          {formatInline(line)}
        </span>
      ))}
    </p>
  )
}

export function AiChatMarkdown({ content, className }: { content: string; className?: string }) {
  const blocks = content.trim().split(/\n{2,}/).filter(Boolean)

  return (
    <div className={cn("space-y-2 text-sm text-foreground", className)}>
      {blocks.map((block, index) => renderBlock(block, index))}
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { AlertCircle, CalendarClock, Loader2, MailQuestion, RefreshCw, Sparkles, Star, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { emailApi, EmailApiError, type InboxBrief } from "@/lib/email-api"

interface AiInboxBriefProps {
  onClose: () => void
  onOpenMessage: (messageId: string) => void
}

export function AiInboxBrief({ onClose, onOpenMessage }: AiInboxBriefProps) {
  const [brief, setBrief] = useState<InboxBrief | null>(null)
  const [scope, setScope] = useState<Array<{ id: string; email: string }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await emailApi.getInboxBrief()
      setBrief(result.brief)
      setScope(result.scope)
    } catch (requestError: any) {
      setError(requestError instanceof EmailApiError && requestError.code === "AI_NOT_CONFIGURED"
        ? "Relay AI needs an OPENAI_API_KEY before it can create an inbox brief."
        : requestError.message || "Could not create your inbox brief.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <header className="flex items-start gap-3 border-b border-border bg-surface-subtle px-4 py-4 sm:px-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft"><Sparkles className="h-5 w-5 text-brand-strong" /></div>
        <div className="min-w-0 flex-1"><h1 className="text-lg font-semibold text-foreground">Inbox brief</h1><p className="mt-0.5 text-xs text-muted-foreground">Based on the latest 50 synced message previews · {scope.length ? scope.map(({ email }) => email).join(", ") : "All accounts"}</p></div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close inbox brief"><X className="h-4 w-4" /></Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        {isLoading ? <div className="flex h-full items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparing your brief…</div> : error ? <div className="mx-auto mt-12 max-w-md rounded-xl border border-destructive/20 bg-destructive/5 p-5 text-center"><AlertCircle className="mx-auto h-6 w-6 text-destructive" /><p className="mt-3 text-sm text-destructive">{error}</p><Button variant="outline" className="mt-4" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Try again</Button></div> : brief ? <div className="mx-auto max-w-3xl space-y-6">
          <div className="rounded-2xl border border-brand/20 bg-brand-soft/35 p-5"><h2 className="text-sm font-semibold text-brand-strong">Today at a glance</h2><p className="mt-2 text-sm leading-6 text-foreground">{brief.overview}</p><p className="mt-3 text-[11px] text-muted-foreground">This brief uses message metadata and previews, not complete conversation history. Verify important details in the email.</p></div>
          <BriefSection title="Needs a reply" icon={MailQuestion} items={brief.needsReply.map((item) => ({ ...item, detail: item.reason }))} onOpenMessage={onOpenMessage} empty="No likely reply needs found." />
          <BriefSection title="Deadlines" icon={CalendarClock} items={brief.deadlines.map((item) => ({ ...item, detail: `${item.date}${item.evidence ? ` · ${item.evidence}` : ""}` }))} onOpenMessage={onOpenMessage} empty="No explicit deadlines found." />
          <BriefSection title="Notable" icon={Star} items={brief.notable.map((item) => ({ ...item, detail: item.reason }))} onOpenMessage={onOpenMessage} empty="No other notable messages found." />
        </div> : null}
      </div>
    </div>
  )
}

function BriefSection({ title, icon: Icon, items, onOpenMessage, empty }: { title: string; icon: typeof Sparkles; items: Array<{ messageId: string; subject: string; detail: string }>; onOpenMessage: (id: string) => void; empty: string }) {
  return <section><div className="mb-3 flex items-center gap-2"><Icon className="h-4 w-4 text-brand" /><h2 className="text-sm font-semibold text-foreground">{title}</h2><span className="rounded-full bg-surface-subtle px-2 py-0.5 text-[11px] text-muted-foreground">{items.length}</span></div>{items.length ? <div className="space-y-2">{items.map((item) => <button key={item.messageId} type="button" onClick={() => onOpenMessage(item.messageId)} className="w-full rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-brand"><div className="text-sm font-medium text-foreground">{item.subject}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p></button>)}</div> : <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">{empty}</p>}</section>
}

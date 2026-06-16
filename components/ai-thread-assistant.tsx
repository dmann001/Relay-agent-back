"use client"

import { useEffect, useRef, useState } from "react"
import { Bot, Check, CheckSquare, ChevronRight, FilePenLine, Loader2, MessageCircleQuestion, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { emailApi, EmailApiError, type ThreadAiResult, type ThreadAiResponse } from "@/lib/email-api"
import { cn } from "@/lib/utils"
import { TrackCommitmentDialog, type CommitmentCandidate } from "@/components/track-commitment-dialog"

type AiAction = "summary" | "draft" | "tasks" | "ask"

interface AiThreadAssistantProps {
  messageId: string
  accountId?: string
  subject: string
  open: boolean
  initialAction?: AiAction
  onOpenChange: (open: boolean) => void
  onInsertDraft: (draft: string) => void
}

const actionLabels: Record<AiAction, string> = {
  summary: "Summarize",
  draft: "Draft reply",
  tasks: "Extract tasks",
  ask: "Ask Relay",
}

function ResultContent({ result, response, onInsertDraft }: { result: ThreadAiResult; response: ThreadAiResponse; onInsertDraft: (draft: string) => void }) {
  const [candidate, setCandidate] = useState<CommitmentCandidate | null>(null)
  const [trackedTitles, setTrackedTitles] = useState<string[]>([])
  if (result.kind === "summary") return (
    <div className="space-y-5">
      <section><h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Summary</h3><p className="mt-2 text-sm leading-6 text-foreground">{result.summary}</p></section>
      {!!result.keyPoints.length && <section><h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Key points</h3><ul className="mt-2 space-y-2">{result.keyPoints.map((point, index) => <li key={index} className="flex gap-2 text-sm leading-5"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />{point}</li>)}</ul></section>}
      {!!result.openQuestions.length && <section><h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Open questions</h3><ul className="mt-2 space-y-2">{result.openQuestions.map((question, index) => <li key={index} className="text-sm leading-5 text-foreground">• {question}</li>)}</ul></section>}
      <section className="rounded-xl border border-brand/20 bg-brand-soft/40 p-3"><h3 className="text-xs font-semibold text-brand-strong">Suggested next action</h3><p className="mt-1 text-sm text-foreground">{result.suggestedAction}</p></section>
    </div>
  )

  if (result.kind === "draft") return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4"><div className="whitespace-pre-wrap text-sm leading-6 text-foreground">{result.draft}</div></div>
      <Button className="w-full bg-brand text-brand-foreground hover:bg-brand-strong" onClick={() => onInsertDraft(result.draft)}>Insert into reply</Button>
      <p className="text-xs leading-5 text-muted-foreground">{result.rationale}</p>
      {!!result.assumptions.length && <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3"><div className="text-xs font-semibold text-amber-700 dark:text-amber-300">Review these assumptions</div>{result.assumptions.map((item, index) => <p key={index} className="mt-1 text-xs text-muted-foreground">• {item}</p>)}</div>}
      <p className="text-[11px] text-muted-foreground">Relay never sends AI-generated drafts automatically.</p>
    </div>
  )

  if (result.kind === "tasks") return (
    <div className="space-y-3">
      {result.tasks.length ? result.tasks.map((task, index) => (
        <div key={index} className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-start gap-2"><CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-brand" /><div><div className="text-sm font-medium text-foreground">{task.title}</div><div className="mt-1 text-xs text-muted-foreground">{task.owner || "Owner not stated"}{task.dueDate ? ` · ${task.dueDate}` : " · No date stated"}</div></div></div>
          <p className="mt-2 border-l-2 border-border pl-2 text-xs leading-5 text-muted-foreground">{task.evidence}</p>
          <Button variant="outline" size="sm" className="mt-3 w-full" disabled={trackedTitles.includes(task.title)} onClick={() => setCandidate(task)}>
            {trackedTitles.includes(task.title) ? <><Check className="mr-2 h-3.5 w-3.5" />Tracked</> : "Track commitment"}
          </Button>
        </div>
      )) : <p className="text-sm text-muted-foreground">No concrete tasks were found in this email.</p>}
      {result.notes && <p className="text-xs leading-5 text-muted-foreground">{result.notes}</p>}
      <TrackCommitmentDialog candidate={candidate} accountId={response.context.accountId} providerMessageId={response.context.messageId} open={Boolean(candidate)} onOpenChange={(open) => { if (!open) setCandidate(null) }} onTracked={() => { if (candidate) setTrackedTitles((current) => [...current, candidate.title]) }} />
    </div>
  )

  return <div className="space-y-4"><p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{result.answer}</p>{!!result.evidence.length && <div><h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evidence</h3>{result.evidence.map((item, index) => <p key={index} className="mt-2 border-l-2 border-border pl-2 text-xs leading-5 text-muted-foreground">{item}</p>)}</div>}</div>
}

export function AiThreadAssistant({ messageId, accountId, subject, open, initialAction, onOpenChange, onInsertDraft }: AiThreadAssistantProps) {
  const [response, setResponse] = useState<ThreadAiResponse | null>(null)
  const [activeAction, setActiveAction] = useState<AiAction>(initialAction || "summary")
  const [question, setQuestion] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const lastAutoRun = useRef<string | null>(null)

  const run = async (action: AiAction, prompt?: string) => {
    setActiveAction(action)
    setIsLoading(true)
    setError(null)
    try {
      setResponse(await emailApi.runThreadAi({ messageId, action, prompt, accountId }))
    } catch (requestError: any) {
      const configured = !(requestError instanceof EmailApiError && requestError.code === "AI_NOT_CONFIGURED")
      setError(configured ? requestError.message || "Relay AI could not complete this request." : "Relay AI needs an OPENAI_API_KEY before it can analyze mail.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    setResponse(null)
    setError(null)
    setQuestion("")
    lastAutoRun.current = null
  }, [messageId, accountId])

  useEffect(() => {
    if (!open || !initialAction) return
    const key = `${messageId}:${initialAction}`
    if (lastAutoRun.current === key) return
    lastAutoRun.current = key
    if (initialAction === "ask") {
      setActiveAction("ask")
      return
    }
    void run(initialAction)
    // run is intentionally scoped to the current action/message opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, initialAction, messageId, open])

  if (!open) return null

  return (
    <aside className="fixed inset-0 z-50 flex justify-end bg-black/20 md:static md:z-auto md:h-full md:w-[24rem] md:shrink-0 md:bg-transparent" aria-label="Relay AI assistant">
      <div className="flex h-full w-full max-w-[26rem] flex-col border-l border-border bg-background shadow-2xl md:shadow-none">
        <header className="border-b border-border px-4 py-3">
          <div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft"><Sparkles className="h-4 w-4 text-brand-strong" /></div><div className="min-w-0 flex-1"><h2 className="text-sm font-semibold text-foreground">Relay Assistant</h2><p className="truncate text-xs text-muted-foreground">Current email · {subject}</p></div><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)} aria-label="Close assistant"><X className="h-4 w-4" /></Button></div>
          {response?.context && <div className="mt-3 flex flex-wrap gap-1.5"><span className="rounded-full border border-border bg-surface-subtle px-2 py-1 text-[11px] text-muted-foreground">{response.context.accountEmail}</span><span className="max-w-full truncate rounded-full border border-border bg-surface-subtle px-2 py-1 text-[11px] text-muted-foreground">Current email</span></div>}
        </header>

        <div className="flex gap-1 overflow-x-auto border-b border-border p-2">
          {(["summary", "draft", "tasks", "ask"] as AiAction[]).map((action) => <button key={action} onClick={() => action === "ask" ? setActiveAction("ask") : void run(action)} className={cn("shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium", activeAction === action ? "bg-brand-soft text-brand-strong" : "text-muted-foreground hover:bg-surface-hover")}>{actionLabels[action]}</button>)}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {isLoading ? <div className="flex h-full items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing this email…</div> : error ? <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4"><p className="text-sm text-destructive">{error}</p><Button variant="outline" size="sm" className="mt-3" onClick={() => void run(activeAction, activeAction === "ask" ? question : undefined)}>Try again</Button></div> : response ? <ResultContent result={response.result} response={response} onInsertDraft={onInsertDraft} /> : <div className="py-8 text-center"><Bot className="mx-auto h-8 w-8 text-brand" /><p className="mt-3 text-sm text-foreground">Choose an action to work with this email.</p><p className="mt-1 text-xs text-muted-foreground">Relay only uses the current email and account preferences.</p></div>}
        </div>

        {activeAction === "ask" && <form className="border-t border-border p-3" onSubmit={(event) => { event.preventDefault(); if (question.trim()) void run("ask", question.trim()) }}><Textarea value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={2000} placeholder="Ask about this email…" className="min-h-20 resize-none" /><Button type="submit" aria-label="Submit question" className="mt-2 w-full" disabled={!question.trim() || isLoading}>Ask Relay <ChevronRight className="ml-1 h-4 w-4" /></Button></form>}
      </div>
    </aside>
  )
}

export function AiActionStrip({ onAction, onTrack }: { onAction: (action: Exclude<AiAction, "ask"> | "ask") => void; onTrack?: () => void }) {
  return <div className="flex flex-wrap gap-2" aria-label="AI email actions"><Button variant="outline" size="sm" onClick={() => onAction("summary")}><Sparkles className="mr-2 h-3.5 w-3.5" />Summarize</Button><Button variant="outline" size="sm" onClick={() => onAction("draft")}><FilePenLine className="mr-2 h-3.5 w-3.5" />Draft reply</Button><Button variant="outline" size="sm" onClick={() => onAction("tasks")}><CheckSquare className="mr-2 h-3.5 w-3.5" />Extract tasks</Button>{onTrack && <Button variant="outline" size="sm" onClick={onTrack}><CheckSquare className="mr-2 h-3.5 w-3.5" />Track follow-up</Button>}<Button variant="outline" size="sm" onClick={() => onAction("ask")}><MessageCircleQuestion className="mr-2 h-3.5 w-3.5" />Ask Relay</Button></div>
}

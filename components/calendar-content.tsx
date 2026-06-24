"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Bot,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Video,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ProviderIcon } from "@/components/provider-icon"
import { emailApi, type CalendarAgendaEvent, type CalendarConnection } from "@/lib/email-api"
import { cn } from "@/lib/utils"

type MeetingForm = {
  accountId: string
  title: string
  description: string
  startsAt: string
  endsAt: string
  attendees: string
  location: string
  timezone: string
  reminderMinutes: number
  createConference: boolean
}

type MeetingChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  hasDraft?: boolean
}

type ViewMode = "month" | "agenda"

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const miniWeekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
const monthNames = Array.from({ length: 12 }, (_, month) =>
  new Intl.DateTimeFormat(undefined, { month: "long" }).format(new Date(2026, month, 1)),
)

const localDateTimeValue = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const startOfDay = (date: Date) => {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const monthLabel = (date: Date) =>
  new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date)

const fullDateLabel = (date: Date) =>
  new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(date)

const dayKey = (date: Date) => startOfDay(date).toISOString().slice(0, 10)

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/

const calendarValueToDate = (value: string) => {
  if (dateOnlyPattern.test(value)) {
    const [year, month, day] = value.split("-").map(Number)
    return new Date(year, month - 1, day)
  }
  return new Date(value)
}

const formatTime = (value: string) => {
  if (dateOnlyPattern.test(value)) return "All day"
  const date = calendarValueToDate(value)
  if (Number.isNaN(date.getTime())) return "Time unavailable"
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date)
}

const formatEventRange = (event: CalendarAgendaEvent) =>
  dateOnlyPattern.test(event.startsAt) ? "All day" : `${formatTime(event.startsAt)} - ${formatTime(event.endsAt)}`

const dateInputToIso = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toISOString()
}

const isoToLocalInput = (value: string) => {
  const date = calendarValueToDate(value)
  return Number.isNaN(date.getTime()) ? "" : localDateTimeValue(date)
}

const parseAttendees = (value: string) =>
  value.split(/[,\n;]/).map((item) => item.trim()).filter(Boolean)

const connectionLabel = (connection: CalendarConnection) =>
  `${connection.accountEmail || "Connected account"} (${connection.provider === "outlook" ? "Outlook" : "Google"})`

const accountAccent = (provider: CalendarConnection["provider"]) =>
  provider === "outlook" ? "bg-sky-500" : "bg-emerald-500"

const eventAccent = (provider: CalendarAgendaEvent["provider"]) =>
  provider === "outlook"
    ? "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-200"
    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"

const defaultForm = (accountId = "", date?: Date): MeetingForm => {
  const start = date ? new Date(date) : new Date(Date.now() + 60 * 60 * 1000)
  start.setMinutes(0, 0, 0)
  if (date) start.setHours(9, 0, 0, 0)
  const end = new Date(start.getTime() + 30 * 60 * 1000)
  return {
    accountId,
    title: "",
    description: "",
    startsAt: localDateTimeValue(start),
    endsAt: localDateTimeValue(end),
    attendees: "",
    location: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    reminderMinutes: 30,
    createConference: true,
  }
}

const formFromEvent = (event: CalendarAgendaEvent): MeetingForm => ({
  accountId: event.accountId,
  title: event.title,
  description: event.description || "",
  startsAt: isoToLocalInput(event.startsAt),
  endsAt: isoToLocalInput(event.endsAt),
  attendees: event.attendees.join(", "),
  location: event.location || "",
  timezone: event.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  reminderMinutes: 30,
  createConference: Boolean(event.meetingUrl),
})

export function CalendarContent() {
  const [connections, setConnections] = useState<CalendarConnection[]>([])
  const [events, setEvents] = useState<CalendarAgendaEvent[]>([])
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()))
  const [accountId, setAccountId] = useState("all")
  const [viewMode, setViewMode] = useState<ViewMode>("month")
  const [searchQuery, setSearchQuery] = useState("")
  const [form, setForm] = useState<MeetingForm>(() => defaultForm())
  const [aiPrompt, setAiPrompt] = useState("")
  const [meetingMessages, setMeetingMessages] = useState<MeetingChatMessage[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [eventOpen, setEventOpen] = useState(false)
  const [monthPickerOpen, setMonthPickerOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarAgendaEvent | null>(null)
  const [pickerMonth, setPickerMonth] = useState(month.getMonth())
  const [pickerYear, setPickerYear] = useState(month.getFullYear())
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isSavingEvent, setIsSavingEvent] = useState(false)
  const [isDeletingEvent, setIsDeletingEvent] = useState(false)
  const [isDrafting, setIsDrafting] = useState(false)

  const calendarAccounts = useMemo(
    () => connections.filter((connection) => connection.status === "connected"),
    [connections],
  )

  const visibleRange = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const gridStart = addDays(first, -first.getDay())
    const gridEnd = addDays(gridStart, 42)
    return { gridStart, gridEnd }
  }, [month])

  const monthDays = useMemo(
    () => Array.from({ length: 42 }, (_, index) => addDays(visibleRange.gridStart, index)),
    [visibleRange.gridStart],
  )

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [nextConnections, agenda] = await Promise.all([
        emailApi.listCalendarConnections(),
        emailApi.listCalendarAgenda({
          accountId: accountId === "all" ? undefined : accountId,
          start: visibleRange.gridStart.toISOString(),
          end: visibleRange.gridEnd.toISOString(),
        }),
      ])
      setConnections(nextConnections)
      setEvents(agenda.events)
      setNotice(agenda.errors.length ? agenda.errors.map((item) => item.message).join(" ") : null)
    } catch (caught: any) {
      setError(caught.message || "Could not load calendars.")
    } finally {
      setIsLoading(false)
    }
  }, [accountId, visibleRange.gridEnd, visibleRange.gridStart])

  useEffect(() => {
    void load()
    const onUpdate = () => void load()
    window.addEventListener("relay-calendar-updated", onUpdate)
    return () => window.removeEventListener("relay-calendar-updated", onUpdate)
  }, [load])

  useEffect(() => {
    if (!form.accountId && calendarAccounts.length === 1) {
      setForm((current) => ({ ...current, accountId: calendarAccounts[0].accountId }))
    }
  }, [calendarAccounts, form.accountId])

  useEffect(() => {
    setPickerMonth(month.getMonth())
    setPickerYear(month.getFullYear())
  }, [month])

  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return events
    return events.filter((event) => [
      event.title,
      event.location || "",
      event.accountEmail || "",
      event.attendees.join(" "),
    ].join(" ").toLowerCase().includes(query))
  }, [events, searchQuery])

  const eventsByDay = useMemo(() => {
    const grouped = new Map<string, CalendarAgendaEvent[]>()
    filteredEvents.forEach((event) => {
      const key = dayKey(calendarValueToDate(event.startsAt))
      grouped.set(key, [...(grouped.get(key) || []), event])
    })
    return grouped
  }, [filteredEvents])

  const selectedDayEvents = eventsByDay.get(dayKey(selectedDate)) || []
  const today = dayKey(new Date())

  const updateForm = <K extends keyof MeetingForm>(key: K, value: MeetingForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const selectedAccountForCreate = () =>
    accountId !== "all" ? accountId : form.accountId || (calendarAccounts.length === 1 ? calendarAccounts[0].accountId : "")

  const openCreate = (date = selectedDate) => {
    const next = defaultForm(selectedAccountForCreate(), date)
    setForm(next)
    setAiPrompt(`Create a meeting on ${date.toLocaleDateString()} at 9 AM.`)
    setMeetingMessages([])
    setError(null)
    setNotice(null)
    setCreateOpen(true)
  }

  const openEvent = (event: CalendarAgendaEvent) => {
    setSelectedEvent(event)
    setForm(formFromEvent(event))
    setError(null)
    setNotice(null)
    setEventOpen(true)
  }

  const selectDate = (date: Date) => {
    const normalized = startOfDay(date)
    setSelectedDate(normalized)
    if (date.getMonth() !== month.getMonth() || date.getFullYear() !== month.getFullYear()) {
      setMonth(new Date(date.getFullYear(), date.getMonth(), 1))
    }
  }

  const goToToday = () => {
    const now = startOfDay(new Date())
    setSelectedDate(now)
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1))
  }

  const applyMonthPicker = () => {
    const nextYear = Number.isFinite(pickerYear) ? pickerYear : new Date().getFullYear()
    const next = new Date(nextYear, pickerMonth, 1)
    setMonth(next)
    setSelectedDate(startOfDay(next))
    setMonthPickerOpen(false)
  }

  const validateForm = () => {
    const startsAt = dateInputToIso(form.startsAt)
    const endsAt = dateInputToIso(form.endsAt)
    if (!form.accountId) return "Choose a calendar account."
    if (!form.title.trim()) return "Add a title."
    if (!startsAt || !endsAt) return "Add a valid start and end time."
    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) return "End time must be after start time."
    return null
  }

  const createMeeting = async () => {
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }
    setIsCreating(true)
    setError(null)
    setNotice(null)
    try {
      const result = await emailApi.createCalendarMeeting({
        accountId: form.accountId,
        title: form.title.trim(),
        description: form.description || undefined,
        startsAt: dateInputToIso(form.startsAt),
        endsAt: dateInputToIso(form.endsAt),
        timezone: form.timezone || "UTC",
        attendees: parseAttendees(form.attendees),
        location: form.location || undefined,
        reminderMinutes: Number(form.reminderMinutes) || 0,
        createConference: form.createConference,
      })
      setNotice(result.event.meetingUrl ? `Meeting created. Join link: ${result.event.meetingUrl}` : "Meeting created.")
      setCreateOpen(false)
      setSelectedDate(startOfDay(calendarValueToDate(result.event.startsAt)))
      await load()
    } catch (caught: any) {
      setError(caught.message || "Could not create the meeting.")
    } finally {
      setIsCreating(false)
    }
  }

  const saveEvent = async () => {
    if (!selectedEvent) return
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }
    setIsSavingEvent(true)
    setError(null)
    setNotice(null)
    try {
      const result = await emailApi.updateCalendarMeeting(selectedEvent.id, {
        accountId: selectedEvent.accountId,
        calendarId: selectedEvent.calendarId || "primary",
        title: form.title.trim(),
        description: form.description || undefined,
        startsAt: dateInputToIso(form.startsAt),
        endsAt: dateInputToIso(form.endsAt),
        timezone: form.timezone || "UTC",
        attendees: parseAttendees(form.attendees),
        location: form.location || undefined,
        reminderMinutes: Number(form.reminderMinutes) || 0,
      })
      setNotice("Event updated.")
      setEventOpen(false)
      setSelectedDate(startOfDay(calendarValueToDate(result.event.startsAt)))
      await load()
    } catch (caught: any) {
      setError(caught.message || "Could not update the event.")
    } finally {
      setIsSavingEvent(false)
    }
  }

  const deleteEvent = async () => {
    if (!selectedEvent) return
    setIsDeletingEvent(true)
    setError(null)
    setNotice(null)
    try {
      await emailApi.deleteCalendarMeeting(selectedEvent)
      setNotice("Event deleted.")
      setEventOpen(false)
      setSelectedEvent(null)
      await load()
    } catch (caught: any) {
      setError(caught.message || "Could not delete the event.")
    } finally {
      setIsDeletingEvent(false)
    }
  }

  const draftWithAi = async () => {
    const prompt = aiPrompt.trim()
    if (!prompt) return
    setIsDrafting(true)
    setError(null)
    setNotice(null)
    setAiPrompt("")
    setMeetingMessages((current) => [...current, { id: `user-${Date.now()}`, role: "user", content: prompt }])
    try {
      const { draft } = await emailApi.draftCalendarMeeting({
        prompt,
        accountId: form.accountId || selectedAccountForCreate() || undefined,
        timezone: form.timezone,
      })
      setForm((current) => ({
        ...current,
        accountId: draft.accountId || current.accountId,
        title: draft.title || current.title,
        description: draft.description || current.description,
        startsAt: draft.startsAt ? isoToLocalInput(draft.startsAt) || current.startsAt : current.startsAt,
        endsAt: draft.endsAt ? isoToLocalInput(draft.endsAt) || current.endsAt : current.endsAt,
        attendees: draft.attendees.length ? draft.attendees.join(", ") : current.attendees,
        location: draft.location || current.location,
        timezone: draft.timezone || current.timezone,
        reminderMinutes: draft.reminderMinutes ?? current.reminderMinutes,
        createConference: draft.createConference,
      }))
      const assistantMessage = draft.missing.length
        ? `I drafted the details I could infer. Fill: ${draft.missing.join(", ")}.`
        : draft.needsAccountSelection
          ? "I drafted the meeting. Choose which calendar account should create it."
          : "I drafted the meeting. Review the invite before creating it."
      setMeetingMessages((current) => [
        ...current,
        { id: `assistant-${Date.now()}`, role: "assistant", content: assistantMessage, hasDraft: true },
      ])
    } catch (caught: any) {
      setError(caught.message || "Could not draft a meeting.")
    } finally {
      setIsDrafting(false)
    }
  }

  const canSubmit = !validateForm()
  const hasDraft = Boolean(form.title || form.attendees || form.location || form.description)
  const latestDraftMessageId = useMemo(
    () => [...meetingMessages].reverse().find((message) => message.hasDraft)?.id,
    [meetingMessages],
  )

  const renderMeetingForm = (mode: "create" | "edit") => (
    <div className="space-y-3 rounded-lg border border-border bg-background p-3 text-foreground">
      {(calendarAccounts.length > 1 || !form.accountId) && (
        <label className="block text-xs font-medium text-muted-foreground">
          Calendar account
          <select
            value={form.accountId}
            disabled={mode === "edit"}
            onChange={(event) => updateForm("accountId", event.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Choose account</option>
            {calendarAccounts.map((connection) => (
              <option key={connection.accountId} value={connection.accountId}>{connectionLabel(connection)}</option>
            ))}
          </select>
        </label>
      )}
      {calendarAccounts.length === 1 && form.accountId && (
        <div className="rounded-md border border-border bg-surface-subtle px-3 py-2 text-xs text-muted-foreground">
          Calendar: {calendarAccounts[0].accountEmail}
        </div>
      )}
      <label className="block text-xs font-medium text-muted-foreground">
        Title
        <input
          value={form.title}
          onChange={(event) => updateForm("title", event.target.value)}
          className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-muted-foreground">
          Starts
          <input
            type="datetime-local"
            value={form.startsAt}
            onChange={(event) => updateForm("startsAt", event.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="block text-xs font-medium text-muted-foreground">
          Ends
          <input
            type="datetime-local"
            value={form.endsAt}
            onChange={(event) => updateForm("endsAt", event.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
        <label className="block text-xs font-medium text-muted-foreground">
          Timezone
          <input
            value={form.timezone}
            onChange={(event) => updateForm("timezone", event.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="block text-xs font-medium text-muted-foreground">
          Reminder
          <input
            type="number"
            min={0}
            max={40320}
            value={form.reminderMinutes}
            onChange={(event) => updateForm("reminderMinutes", Number(event.target.value))}
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={form.createConference}
          onChange={(event) => updateForm("createConference", event.target.checked)}
          className="h-4 w-4 rounded border-input"
          disabled={mode === "edit"}
        />
        Add video link
      </label>
      <label className="block text-xs font-medium text-muted-foreground">
        Attendees
        <textarea
          value={form.attendees}
          onChange={(event) => updateForm("attendees", event.target.value)}
          placeholder="name@example.com, teammate@example.com"
          className="mt-1 min-h-16 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
      <label className="block text-xs font-medium text-muted-foreground">
        Location
        <input
          value={form.location}
          onChange={(event) => updateForm("location", event.target.value)}
          placeholder={form.createConference ? "Optional, video link will be added" : "Optional"}
          className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
      <label className="block text-xs font-medium text-muted-foreground">
        Notes
        <textarea
          value={form.description}
          onChange={(event) => updateForm("description", event.target.value)}
          className="mt-1 min-h-16 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
    </div>
  )

  return (
    <div className="flex h-full min-h-0 bg-background text-foreground">
      <aside className="hidden w-[18.25rem] shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex h-14 items-center justify-between px-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            Calendar
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openCreate(selectedDate)} aria-label="Create event">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-3 pt-2">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMonthPickerOpen(true)}
              className="rounded-md px-2 py-1 text-sm font-medium hover:bg-sidebar-accent"
            >
              {monthLabel(month)}
            </button>
            <div className="flex gap-1 text-muted-foreground">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-y-2 text-center text-[13px] font-medium">
            {miniWeekdays.map((day) => <div key={day} className="text-muted-foreground">{day}</div>)}
            {monthDays.map((day) => {
              const key = dayKey(day)
              const current = key === today
              const selected = key === dayKey(selectedDate)
              const inMonth = day.getMonth() === month.getMonth()
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => selectDate(day)}
                  className={cn(
                    "mx-auto flex h-7 w-7 items-center justify-center rounded-md text-sm transition-colors hover:bg-sidebar-accent",
                    selected && "bg-brand text-brand-foreground hover:bg-brand",
                    !selected && current && "border border-brand text-brand-strong",
                    !selected && !current && (inMonth ? "text-sidebar-foreground" : "text-muted-foreground/60"),
                  )}
                >
                  {day.getDate()}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-8 px-3">
          <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Calendars</div>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setAccountId("all")}
              className={cn("flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-medium hover:bg-sidebar-accent", accountId === "all" ? "text-sidebar-foreground" : "text-muted-foreground")}
            >
              <span className="h-3 w-3 rounded border border-muted-foreground" />
              All calendars
            </button>
            {calendarAccounts.map((connection) => (
              <button
                key={connection.accountId}
                type="button"
                onClick={() => setAccountId(connection.accountId)}
                className={cn("flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-medium hover:bg-sidebar-accent", accountId === connection.accountId ? "text-sidebar-foreground" : "text-muted-foreground")}
              >
                <span className={cn("h-3 w-3 rounded-sm", accountAccent(connection.provider))} />
                <span className="min-w-0 flex-1 truncate">{connection.accountEmail}</span>
                <ProviderIcon provider={connection.provider} className="h-3.5 w-3.5 opacity-70" />
              </button>
            ))}
          </div>
          <Button asChild variant="ghost" className="mt-5 w-full justify-start px-2 text-muted-foreground hover:text-foreground">
            <Link href="/settings/connections">
              <Plus className="mr-2 h-4 w-4" />
              Add calendar account
            </Link>
          </Button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col bg-background">
        <header className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-2 lg:px-5">
          <div className="flex min-w-0 items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <button
              type="button"
              onClick={() => setMonthPickerOpen(true)}
              className="min-w-0 rounded-lg px-2 py-1 text-left text-xl font-semibold tracking-tight hover:bg-surface-subtle sm:text-2xl"
              aria-label="Choose month and year"
            >
              {monthLabel(month)}
            </button>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="relative hidden sm:block">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search events"
                className="h-9 w-44 rounded-lg border border-input bg-background pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <select
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-ring lg:hidden"
            >
              <option value="all">All calendars</option>
              {calendarAccounts.map((connection) => (
                <option key={connection.accountId} value={connection.accountId}>{connectionLabel(connection)}</option>
              ))}
            </select>
            <select
              value={viewMode}
              onChange={(event) => setViewMode(event.target.value as ViewMode)}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-ring"
              aria-label="Calendar view"
            >
              <option value="month">Month</option>
              <option value="agenda">Agenda</option>
            </select>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
              Sync
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>Today</Button>
            <Button size="sm" onClick={() => openCreate(selectedDate)}>
              <Plus className="mr-2 h-4 w-4" />
              New
            </Button>
          </div>
        </header>

        {(error || notice || (!calendarAccounts.length && !isLoading)) && (
          <div className="border-b border-border px-4 py-2 text-sm">
            {error ? (
              <span className="text-destructive">{error}</span>
            ) : notice ? (
              <span className="text-brand-strong">{notice}</span>
            ) : (
              <span className="text-muted-foreground">Connect calendar access in Settings to sync and create events.</span>
            )}
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          <section className="flex min-w-0 flex-1 flex-col">
            {viewMode === "month" ? (
              <>
                <div className="grid h-9 shrink-0 grid-cols-7 border-b border-border text-sm font-medium text-muted-foreground">
                  {weekdays.map((day) => (
                    <div key={day} className="flex items-center justify-center">{day}</div>
                  ))}
                </div>
                <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
                  {monthDays.map((day) => {
                    const key = dayKey(day)
                    const current = key === today
                    const selected = key === dayKey(selectedDate)
                    const inMonth = day.getMonth() === month.getMonth()
                    const dayEvents = eventsByDay.get(key) || []
                    return (
                      <div
                        key={key}
                        role="button"
                        tabIndex={0}
                        onClick={() => selectDate(day)}
                        onDoubleClick={() => openCreate(day)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            selectDate(day)
                          }
                        }}
                        className={cn(
                          "min-h-24 border-b border-r border-border bg-background p-1.5 text-left outline-none transition-colors hover:bg-surface-subtle focus-visible:bg-surface-subtle sm:min-h-28 sm:p-2",
                          selected && "bg-surface-subtle",
                        )}
                      >
                        <div className={cn("mb-1 flex items-center justify-between gap-1 text-sm font-medium", inMonth ? "text-foreground" : "text-muted-foreground/60")}>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              openCreate(day)
                            }}
                            className="hidden h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-hover hover:text-foreground group-hover:flex sm:flex"
                            aria-label={`Create event on ${day.toLocaleDateString()}`}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                          <span className={cn("ml-auto flex h-7 min-w-7 items-center justify-center rounded-md px-1", current && "bg-brand text-brand-foreground")}>
                            {day.getDate() === 1 ? `${day.toLocaleDateString(undefined, { month: "short" })} ${day.getDate()}` : day.getDate()}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {dayEvents.slice(0, 4).map((event) => (
                            <button
                              key={`${event.accountId}:${event.id}`}
                              type="button"
                              onClick={(clickEvent) => {
                                clickEvent.stopPropagation()
                                openEvent(event)
                              }}
                              className={cn("block w-full truncate rounded-md border px-2 py-1 text-left text-xs font-medium", eventAccent(event.provider))}
                              title={`${event.title} - ${formatEventRange(event)}`}
                            >
                              {event.meetingUrl ? <Video className="mr-1 inline h-3 w-3" /> : null}
                              {formatTime(event.startsAt)} {event.title}
                            </button>
                          ))}
                          {dayEvents.length > 4 && <div className="px-2 text-xs text-muted-foreground">+{dayEvents.length - 4} more</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <div className="mx-auto max-w-3xl space-y-2">
                  {filteredEvents.length ? filteredEvents.map((event) => (
                    <button
                      key={`${event.accountId}:${event.id}`}
                      type="button"
                      onClick={() => openEvent(event)}
                      className="flex w-full items-start gap-3 rounded-lg border border-border bg-card p-3 text-left hover:bg-surface-subtle"
                    >
                      <span className={cn("mt-1 h-2.5 w-2.5 rounded-full", event.provider === "outlook" ? "bg-sky-500" : "bg-emerald-500")} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{event.title}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          {calendarValueToDate(event.startsAt).toLocaleDateString()} {formatEventRange(event)}
                          {event.accountEmail ? <span>{event.accountEmail}</span> : null}
                        </span>
                      </span>
                      {event.meetingUrl ? <Video className="h-4 w-4 text-muted-foreground" /> : null}
                    </button>
                  )) : (
                    <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
                      No events match this view.
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          <aside className="hidden w-80 shrink-0 border-l border-border bg-card lg:flex lg:flex-col">
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{fullDateLabel(selectedDate)}</div>
                <div className="text-xs text-muted-foreground">{selectedDayEvents.length} event{selectedDayEvents.length === 1 ? "" : "s"}</div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openCreate(selectedDate)} aria-label="Create event">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {selectedDayEvents.length ? (
                <div className="space-y-2">
                  {selectedDayEvents.map((event) => (
                    <button
                      key={`${event.accountId}:${event.id}`}
                      type="button"
                      onClick={() => openEvent(event)}
                      className="w-full rounded-lg border border-border bg-background p-3 text-left hover:bg-surface-subtle"
                    >
                      <div className="flex items-start gap-2">
                        <span className={cn("mt-1.5 h-2 w-2 rounded-full", event.provider === "outlook" ? "bg-sky-500" : "bg-emerald-500")} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{event.title}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{formatEventRange(event)}</div>
                          {event.location ? <div className="mt-1 truncate text-xs text-muted-foreground">{event.location}</div> : null}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                  No events for this date.
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>

      {!createOpen && (
        <div className="fixed bottom-3 right-3 z-40">
          <Button onClick={() => openCreate(selectedDate)} className="h-10 rounded-lg shadow-lg">
            <Bot className="mr-2 h-4 w-4" />
            Ask Relay
          </Button>
        </div>
      )}

      <Dialog open={monthPickerOpen} onOpenChange={setMonthPickerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Choose month</DialogTitle>
            <DialogDescription>Jump to a specific month and year.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="block text-xs font-medium text-muted-foreground">
              Month
              <select
                value={pickerMonth}
                onChange={(event) => setPickerMonth(Number(event.target.value))}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              >
                {monthNames.map((name, index) => <option key={name} value={index}>{name}</option>)}
              </select>
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              Year
              <input
                type="number"
                min={1900}
                max={2100}
                value={pickerYear}
                onChange={(event) => setPickerYear(Number(event.target.value))}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setMonthPickerOpen(false)}>Cancel</Button>
              <Button onClick={applyMonthPicker}>Go</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-5 py-4">
            <DialogTitle>Create calendar invite</DialogTitle>
            <DialogDescription>Ask Relay to draft the invite, or fill in the details manually.</DialogDescription>
          </DialogHeader>
          <div className="flex max-h-[calc(90vh-7rem)] flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {!meetingMessages.length && (
                <div className="rounded-lg border border-dashed border-border bg-surface-subtle p-4 text-sm text-muted-foreground">
                  Ask in plain English, or edit the invite fields below.
                </div>
              )}
              {meetingMessages.map((message) => (
                <div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[88%] rounded-xl px-3 py-2 text-sm",
                    message.role === "user" ? "bg-brand text-brand-foreground" : "border border-border bg-surface-subtle text-foreground",
                  )}>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {message.hasDraft && message.id === latestDraftMessageId && hasDraft ? (
                      <div className="mt-3">{renderMeetingForm("create")}</div>
                    ) : null}
                  </div>
                </div>
              ))}
              {isDrafting && (
                <div className="flex justify-start">
                  <div className="rounded-xl border border-border bg-surface-subtle px-3 py-2 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Relay is drafting the invite...
                  </div>
                </div>
              )}
              {!hasDraft && renderMeetingForm("create")}
              {notice && <p className="text-sm text-brand-strong">{notice}</p>}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <div className="border-t border-border p-4">
              <div className="flex gap-2">
                <textarea
                  value={aiPrompt}
                  onChange={(event) => setAiPrompt(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault()
                      void draftWithAi()
                    }
                  }}
                  placeholder="Tell Relay what meeting to set up..."
                  className="min-h-11 flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                />
                <Button onClick={() => void draftWithAi()} disabled={!aiPrompt.trim() || isDrafting} className="h-11 px-3" aria-label="Send to Relay">
                  {isDrafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={() => void createMeeting()} disabled={!canSubmit || isCreating}>
                  {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarDays className="mr-2 h-4 w-4" />}
                  Create invite
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={eventOpen} onOpenChange={setEventOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-muted-foreground" />
              Event details
            </DialogTitle>
            <DialogDescription>Review, edit, or remove this calendar event.</DialogDescription>
          </DialogHeader>
          {selectedEvent ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-subtle px-2 py-1">
                  <ProviderIcon provider={selectedEvent.provider} className="h-3.5 w-3.5" />
                  {selectedEvent.accountEmail || "Connected account"}
                </span>
                {selectedEvent.meetingUrl ? (
                  <a href={selectedEvent.meetingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-subtle px-2 py-1 hover:text-foreground">
                    <Video className="h-3.5 w-3.5" />
                    Join
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
                {selectedEvent.htmlLink ? (
                  <a href={selectedEvent.htmlLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-subtle px-2 py-1 hover:text-foreground">
                    Open source
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </div>
              {renderMeetingForm("edit")}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => void deleteEvent()}
                  disabled={isDeletingEvent || isSavingEvent}
                >
                  {isDeletingEvent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Delete
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setEventOpen(false)}>
                    <X className="mr-2 h-4 w-4" />
                    Close
                  </Button>
                  <Button onClick={() => void saveEvent()} disabled={!canSubmit || isSavingEvent || isDeletingEvent}>
                    {isSavingEvent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                    Save changes
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { storage } from "@/lib/storage"
import { api } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Sparkles,
  Mail,
  TrendingUp,
  Zap,
  Brain,
  Target,
  Clock,
  CheckCircle2,
  AlertCircle,
  Settings,
  Play,
  Filter,
  ListTodo,
  BarChart3,
  RefreshCw,
  Trash2,
  Plus,
  Loader2,
} from "lucide-react"

import type {
  ExtractedTask,
  Reminder,
  SmartFilter,
  AgentUsageStats,
} from "@/types"

// Status configuration
const statusConfig = {
  active: { label: "Active", variant: "default" as const, icon: CheckCircle2, color: "text-green-500" },
  beta: { label: "Beta", variant: "secondary" as const, icon: AlertCircle, color: "text-yellow-500" },
  "coming-soon": { label: "Coming Soon", variant: "outline" as const, icon: Clock, color: "text-muted-foreground" },
}

// Format number with suffix
function formatNumber(num: number): string {
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`
  return num.toString()
}

// Format minutes to readable time
function formatTimeSaved(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} mins`
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  return mins > 0 ? `${hours}h ${mins}m` : `${hours} hours`
}

export function AgentActions() {
  const [activeTab, setActiveTab] = useState("overview")
  const [usageStats, setUsageStats] = useState<AgentUsageStats | null>(null)
  const [tasks, setTasks] = useState<ExtractedTask[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [filters, setFilters] = useState<SmartFilter[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [settings, setSettings] = useState(storage.getSettings())

  // Dialog states
  const [newFilterQuery, setNewFilterQuery] = useState("")
  const [newFilterName, setNewFilterName] = useState("")
  const [isCreatingFilter, setIsCreatingFilter] = useState(false)

  const { toast } = useToast()

  // Load data on mount
  useEffect(() => {
    loadData()
  }, [])

  const loadData = () => {
    setUsageStats(storage.getUsageStats())
    setTasks(storage.getTasks())
    setReminders(storage.getReminders())
    setFilters(storage.getSmartFilters())
    setSettings(storage.getSettings())
  }

  // Toggle AI feature setting
  const toggleFeature = (feature: keyof typeof settings.aiFeatures) => {
    const newSettings = {
      ...settings,
      aiFeatures: {
        ...settings.aiFeatures,
        [feature]: !settings.aiFeatures[feature],
      },
    }
    storage.updateSettings(newSettings)
    setSettings(newSettings)
    toast({
      title: `${feature} ${newSettings.aiFeatures[feature] ? "Enabled" : "Disabled"}`,
      description: `AI ${feature} has been ${newSettings.aiFeatures[feature] ? "enabled" : "disabled"}`,
    })
  }

  // Run task extraction on all emails
  const runTaskExtraction = async () => {
    setIsLoading(true)
    try {
      const emails = storage.getEmails().filter(e => !e.extractedTasks || e.extractedTasks.length === 0)
      let totalTasks = 0

      for (const email of emails.slice(0, 20)) { // Limit to 20 for efficiency
        const extractedTasks = await api.ai.extractTasks(email)
        for (const task of extractedTasks) {
          const newTask: ExtractedTask = {
            id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: task.title,
            deadline: task.deadline,
            priority: task.priority,
            sourceEmailId: email.id,
            createdAt: new Date().toISOString(),
            completed: false,
          }
          storage.addTask(newTask)
          totalTasks++
        }
        // Update email with task IDs
        storage.updateEmail(email.id, { extractedTasks: extractedTasks.map((_, i) => `task_${i}`) })
      }

      toast({
        title: "Task Extraction Complete",
        description: `Extracted ${totalTasks} tasks from ${emails.length} emails`,
      })
      loadData()
    } catch {
      toast({ title: "Error", description: "Failed to extract tasks", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  // Run sentiment analysis on emails
  const runSentimentAnalysis = async () => {
    setIsLoading(true)
    try {
      const emails = storage.getEmails().filter(e => !e.sentiment)
      let processed = 0

      for (const email of emails.slice(0, 20)) {
        const sentiment = await api.ai.analyzeSentiment(email)
        storage.updateEmail(email.id, { sentiment })
        storage.incrementUsageStat('sentimentAnalyzed', 1, 0.5)
        processed++
      }

      toast({
        title: "Sentiment Analysis Complete",
        description: `Analyzed ${processed} emails`,
      })
      loadData()
    } catch {
      toast({ title: "Error", description: "Failed to analyze sentiment", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  // Run priority scoring
  const runPriorityScoring = async () => {
    setIsLoading(true)
    try {
      const emails = storage.getEmails().filter(e => e.priorityScore === undefined)
      let processed = 0

      for (const email of emails.slice(0, 20)) {
        const priority = await api.ai.calculatePriority(email)
        storage.updateEmail(email.id, { priorityScore: priority })
        processed++
      }

      toast({
        title: "Priority Scoring Complete",
        description: `Scored ${processed} emails`,
      })
      loadData()
    } catch {
      toast({ title: "Error", description: "Failed to score priorities", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const runAutoCategorization = async () => {
    setIsLoading(true)
    try {
      const emails = storage.getEmails().filter(e => !e.aiLabels || e.aiLabels.length === 0)
      let processed = 0

      for (const email of emails.slice(0, 20)) {
        const category = await api.ai.classifyEmail(email)
        storage.updateEmail(email.id, { aiLabels: [category] })
        storage.incrementUsageStat('emailsCategorized', 1, 0.5)
        processed++
      }

      toast({
        title: "Auto-Categorization Complete",
        description: `Categorized ${processed} emails`,
      })
      loadData()
    } catch {
      toast({ title: "Error", description: "Failed to categorize emails", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const runReplySuggestionsBatch = async () => {
    setIsLoading(true)
    try {
      const settings = storage.getSettings()
      const emails = storage.getEmails().filter(e => !storage.getReplySuggestions(e.id))
      let processed = 0

      for (const email of emails.slice(0, 10)) {
        const suggestions = await api.ai.suggestReplies(email, settings.userContext)
        storage.saveReplySuggestions(email.id, {
          id: `suggestion_${email.id}`,
          emailId: email.id,
          suggestions,
          generatedAt: new Date().toISOString(),
          cached: true,
        })
        processed++
      }

      toast({
        title: "Reply Suggestions Ready",
        description: `Generated suggestions for ${processed} emails`,
      })
      loadData()
    } catch {
      toast({ title: "Error", description: "Failed to generate reply suggestions", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const runEmailSummaries = async () => {
    setIsLoading(true)
    try {
      const emails = storage.getEmails().filter(e => !e.aiSummary)
      let processed = 0

      for (const email of emails.slice(0, 10)) {
        const summary = await api.ai.summarizeThread([email])
        storage.updateEmail(email.id, { aiSummary: summary })
        storage.incrementUsageStat('emailsSummarized', 1, 0.5)
        processed++
      }

      toast({
        title: "Summaries Generated",
        description: `Summarized ${processed} emails`,
      })
      loadData()
    } catch {
      toast({ title: "Error", description: "Failed to summarize emails", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const runMeetingDetection = async () => {
    setIsLoading(true)
    try {
      const emails = storage.getEmails().filter(e => !e.meetingRequest)
      let processed = 0

      for (const email of emails.slice(0, 20)) {
        const meetingRequest = await api.ai.detectMeeting(email)
        storage.updateEmail(email.id, { meetingRequest })
        storage.incrementUsageStat('meetingsDetected', meetingRequest.detected ? 1 : 0, 0.2)
        processed++
      }

      toast({
        title: "Meeting Detection Complete",
        description: `Processed ${processed} emails`,
      })
      loadData()
    } catch {
      toast({ title: "Error", description: "Failed to detect meetings", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const runFollowUpReminders = () => {
    const emails = storage.getEmails()
    const existingReminders = new Set(storage.getReminders().map(r => r.emailId))
    const now = new Date()
    let created = 0

    for (const email of emails) {
      if (existingReminders.has(email.id)) continue

      const emailDate = new Date(email.date)
      const daysOld = Math.floor((now.getTime() - emailDate.getTime()) / (1000 * 60 * 60 * 24))
      const needsFollowUp =
        email.requiresResponse ||
        (email.aiLabels || []).some(l => ['urgent', 'action', 'important'].includes(l.toLowerCase())) ||
        (!email.read && daysOld >= 3)

      if (needsFollowUp) {
        storage.addReminder({
          id: `reminder_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          emailId: email.id,
          threadId: email.threadId,
          reminderDate: new Date().toISOString(),
          reason: `Follow up on email from ${email.from.name}: ${email.subject}`,
          type: 'follow_up',
          active: true,
          createdAt: new Date().toISOString(),
        })
        created++
      }
    }

    toast({
      title: "Follow-up Reminders",
      description: created > 0 ? `Created ${created} reminders` : "No new reminders needed",
    })
    loadData()
  }

  // Create smart filter from natural language
  const createSmartFilter = async () => {
    if (!newFilterQuery.trim()) return
    setIsCreatingFilter(true)
    try {
      const rules = await api.ai.parseFilter(newFilterQuery)
      const newFilter: SmartFilter = {
        id: `filter_${Date.now()}`,
        name: newFilterName || `Filter ${filters.length + 1}`,
        naturalLanguageQuery: newFilterQuery,
        parsedRules: rules,
        action: { type: 'label', value: 'Filtered' },
        enabled: true,
        createdAt: new Date().toISOString(),
        matchCount: 0,
      }
      storage.addSmartFilter(newFilter)
      toast({
        title: "Filter Created",
        description: `Created filter: ${newFilter.name}`,
      })
      setNewFilterQuery("")
      setNewFilterName("")
      loadData()
    } catch {
      toast({ title: "Error", description: "Failed to create filter", variant: "destructive" })
    } finally {
      setIsCreatingFilter(false)
    }
  }

  // Run auto-archive
  const runAutoArchive = async () => {
    setIsLoading(true)
    try {
      const emails = storage.getEmails().filter(e => !e.isArchived)
      const candidates = await api.ai.suggestArchive(emails)
      
      if (candidates.length > 0) {
        storage.bulkArchiveEmails(candidates)
        toast({
          title: "Auto-Archive Complete",
          description: `Archived ${candidates.length} emails`,
        })
      } else {
        toast({
          title: "No Emails to Archive",
          description: "No emails matched archive criteria",
        })
      }
      loadData()
    } catch {
      toast({ title: "Error", description: "Failed to auto-archive", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  // Complete task
  const completeTask = (taskId: string) => {
    storage.updateTask(taskId, { completed: true, completedAt: new Date().toISOString() })
    loadData()
    toast({ title: "Task Completed", description: "Task marked as complete" })
  }

  // Delete task
  const deleteTask = (taskId: string) => {
    storage.removeTask(taskId)
    loadData()
  }

  // Delete filter
  const deleteFilter = (filterId: string) => {
    storage.removeSmartFilter(filterId)
    loadData()
  }

  // Agent action cards data
  const agentActions = [
    {
      category: "Email Management",
      icon: Mail,
      actions: [
        {
          name: "Smart Reply Suggestions",
          description: "Generate contextual reply suggestions based on email content and your writing style",
          status: "active" as const,
          usage: `${formatNumber(usageStats?.smartRepliesGenerated || 0)} generated`,
          feature: "smartReplies" as const,
          onRun: runReplySuggestionsBatch,
        },
        {
          name: "Auto-Categorization",
          description: "Automatically categorize incoming emails into custom folders based on content",
          status: "active" as const,
          usage: `${formatNumber(usageStats?.emailsCategorized || 0)} categorized`,
          feature: "autoLabel" as const,
          onRun: runAutoCategorization,
        },
        {
          name: "Priority Inbox",
          description: "AI-powered sorting to surface the most important emails first",
          status: "active" as const,
          usage: `${storage.getEmails().filter(e => e.priorityScore !== undefined).length} scored`,
          feature: "priorityInbox" as const,
          onRun: runPriorityScoring,
        },
      ],
    },
    {
      category: "Productivity",
      icon: Zap,
      actions: [
        {
          name: "Meeting Scheduler",
          description: "Automatically detect meeting requests in emails",
          status: "beta" as const,
          usage: `${formatNumber(usageStats?.meetingsDetected || 0)} detected`,
          feature: "meetingDetection" as const,
          onRun: runMeetingDetection,
        },
        {
          name: "Task Extraction",
          description: "Extract action items from emails and create tasks automatically",
          status: "active" as const,
          usage: `${formatNumber(usageStats?.tasksExtracted || 0)} tasks`,
          feature: "taskExtraction" as const,
          onRun: runTaskExtraction,
        },
        {
          name: "Follow-up Reminders",
          description: "Set intelligent reminders for emails that need follow-up",
          status: "active" as const,
          usage: `${reminders.filter(r => r.active).length} active`,
          feature: null,
          onRun: runFollowUpReminders,
        },
      ],
    },
    {
      category: "Content Analysis",
      icon: Brain,
      actions: [
        {
          name: "Email Summarization",
          description: "Generate concise summaries of long email threads",
          status: "active" as const,
          usage: `${formatNumber(usageStats?.emailsSummarized || 0)} summarized`,
          feature: "autoSummarize" as const,
          onRun: runEmailSummaries,
        },
        {
          name: "Sentiment Analysis",
          description: "Detect tone and sentiment in incoming emails",
          status: "active" as const,
          usage: `${formatNumber(usageStats?.sentimentAnalyzed || 0)} analyzed`,
          feature: "sentimentAnalysis" as const,
          onRun: runSentimentAnalysis,
        },
        {
          name: "Language Translation",
          description: "Automatically translate emails to your preferred language",
          status: "coming-soon" as const,
          usage: "Coming Q2 2026",
          feature: null,
          onRun: null,
        },
      ],
    },
    {
      category: "Automation",
      icon: Target,
      actions: [
        {
          name: "Smart Filters",
          description: "Create complex email filters using natural language",
          status: "active" as const,
          usage: `${filters.length} filters`,
          feature: null,
          onRun: null,
        },
        {
          name: "Auto-Archive",
          description: "Automatically archive emails based on custom rules",
          status: "active" as const,
          usage: `${formatNumber(usageStats?.emailsArchived || 0)} archived`,
          feature: "autoArchive" as const,
          onRun: runAutoArchive,
        },
        {
          name: "Bulk Actions",
          description: "Perform actions on multiple emails matching specific criteria",
          status: "active" as const,
          usage: `${formatNumber(usageStats?.bulkActionsPerformed || 0)} actions`,
          feature: null,
          onRun: null,
        },
      ],
    },
  ]

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <div className="border-b border-border px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">AI Agent Actions</h1>
            <p className="text-sm text-muted-foreground">
              Explore all available AI-powered features and automations
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="border-b border-border px-6">
          <TabsList className="h-12 w-full justify-start gap-4 rounded-none border-0 bg-transparent p-0">
            <TabsTrigger
              value="overview"
              className="relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-0 font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="tasks"
              className="relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-0 font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              <ListTodo className="mr-2 h-4 w-4" />
              Tasks ({tasks.filter(t => !t.completed).length})
            </TabsTrigger>
            <TabsTrigger
              value="filters"
              className="relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-0 font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              <Filter className="mr-2 h-4 w-4" />
              Filters ({filters.length})
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-0 font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview" className="m-0">
          <div className="space-y-8 p-6">
            {agentActions.map((category) => (
              <div key={category.category}>
                <div className="mb-4 flex items-center gap-2">
                  <category.icon className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">{category.category}</h2>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {category.actions.map((action) => {
                    const statusInfo = statusConfig[action.status]
                    const StatusIcon = statusInfo.icon
                    const isEnabled = action.feature ? settings.aiFeatures[action.feature] : true

                    return (
                      <Card
                        key={action.name}
                        className={cn(
                          "transition-colors hover:bg-muted/50",
                          !isEnabled && action.status !== "coming-soon" && "opacity-60"
                        )}
                      >
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <CardTitle className="text-base">{action.name}</CardTitle>
                            <Badge variant={statusInfo.variant} className="ml-2 shrink-0">
                              <StatusIcon className={cn("mr-1 h-3 w-3", statusInfo.color)} />
                              {statusInfo.label}
                            </Badge>
                          </div>
                          <CardDescription className="text-sm">{action.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">{action.usage}</span>
                            <div className="flex items-center gap-2">
                              {action.onRun && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8"
                                  onClick={action.onRun}
                                  disabled={isLoading || !isEnabled}
                                >
                                  {isLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Play className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                              {action.feature && (
                                <Switch
                                  checked={isEnabled}
                                  onCheckedChange={() => toggleFeature(action.feature!)}
                                />
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Usage Statistics Footer */}
          <div className="border-t border-border bg-muted/30 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="mb-1 font-semibold">Usage Statistics</h3>
                <p className="mb-3 text-sm text-muted-foreground">
                  AI agents have processed{" "}
                  <span className="font-medium text-foreground">
                    {formatNumber(usageStats?.totalEmailsProcessed || 0)}
                  </span>{" "}
                  emails this month, saving you an estimated{" "}
                  <span className="font-medium text-foreground">
                    {formatTimeSaved(usageStats?.estimatedTimeSavedMinutes || 0)}
                  </span>{" "}
                  of manual work.
                </p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="rounded-lg bg-background p-3">
                    <div className="text-2xl font-bold">{formatNumber(usageStats?.emailsSummarized || 0)}</div>
                    <div className="text-xs text-muted-foreground">Summarized</div>
                  </div>
                  <div className="rounded-lg bg-background p-3">
                    <div className="text-2xl font-bold">{formatNumber(usageStats?.tasksExtracted || 0)}</div>
                    <div className="text-xs text-muted-foreground">Tasks Extracted</div>
                  </div>
                  <div className="rounded-lg bg-background p-3">
                    <div className="text-2xl font-bold">{formatNumber(usageStats?.sentimentAnalyzed || 0)}</div>
                    <div className="text-xs text-muted-foreground">Sentiment Analyzed</div>
                  </div>
                  <div className="rounded-lg bg-background p-3">
                    <div className="text-2xl font-bold">{formatNumber(usageStats?.emailsArchived || 0)}</div>
                    <div className="text-xs text-muted-foreground">Auto-Archived</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="m-0">
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Extracted Tasks</h2>
              <Button onClick={runTaskExtraction} disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Extract from Emails
              </Button>
            </div>

            {tasks.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-10">
                  <ListTodo className="h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold">No Tasks Yet</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Click "Extract from Emails" to find action items in your inbox
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {tasks
                  .sort((a, b) => {
                    if (a.completed !== b.completed) return a.completed ? 1 : -1
                    const priorityOrder = { high: 0, medium: 1, low: 2 }
                    return priorityOrder[a.priority] - priorityOrder[b.priority]
                  })
                  .map((task) => (
                    <Card key={task.id} className={cn(task.completed && "opacity-60")}>
                      <CardContent className="flex items-center gap-4 p-4">
                        <Button
                          variant={task.completed ? "default" : "outline"}
                          size="icon"
                          className="h-6 w-6 shrink-0 rounded-full"
                          onClick={() => !task.completed && completeTask(task.id)}
                        >
                          {task.completed && <CheckCircle2 className="h-4 w-4" />}
                        </Button>
                        <div className="flex-1 min-w-0">
                          <p className={cn("font-medium", task.completed && "line-through")}>
                            {task.title}
                          </p>
                          {task.deadline && (
                            <p className="text-xs text-muted-foreground">
                              Due: {new Date(task.deadline).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <Badge
                          variant={
                            task.priority === "high"
                              ? "destructive"
                              : task.priority === "medium"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {task.priority}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteTask(task.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Filters Tab */}
        <TabsContent value="filters" className="m-0">
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Smart Filters</h2>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    New Filter
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Smart Filter</DialogTitle>
                    <DialogDescription>
                      Describe your filter in natural language and AI will convert it to rules
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Filter Name</Label>
                      <Input
                        placeholder="e.g., Manager Updates"
                        value={newFilterName}
                        onChange={(e) => setNewFilterName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Natural Language Query</Label>
                      <Input
                        placeholder="e.g., emails from my manager about project updates"
                        value={newFilterQuery}
                        onChange={(e) => setNewFilterQuery(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={createSmartFilter} disabled={isCreatingFilter || !newFilterQuery}>
                      {isCreatingFilter ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      Create Filter
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {filters.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-10">
                  <Filter className="h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold">No Filters Yet</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Create smart filters using natural language to organize your inbox
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {filters.map((filter) => (
                  <Card key={filter.id}>
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Filter className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{filter.name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          "{filter.naturalLanguageQuery}"
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {filter.matchCount} matches • {filter.parsedRules.length} rules
                        </p>
                      </div>
                      <Switch
                        checked={filter.enabled}
                        onCheckedChange={() => {
                          storage.updateSmartFilter(filter.id, { enabled: !filter.enabled })
                          loadData()
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteFilter(filter.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="m-0">
          <div className="p-6">
            <h2 className="mb-4 text-lg font-semibold">AI Features Configuration</h2>
            <div className="space-y-4">
              {Object.entries(settings.aiFeatures).map(([key, value]) => {
                const featureNames: Record<string, { name: string; description: string }> = {
                  autoSummarize: {
                    name: "Auto-Summarize",
                    description: "Automatically generate summaries for long emails",
                  },
                  autoLabel: {
                    name: "Auto-Label",
                    description: "Automatically categorize emails with AI labels",
                  },
                  smartReplies: {
                    name: "Smart Replies",
                    description: "Generate contextual reply suggestions",
                  },
                  priorityInbox: {
                    name: "Priority Inbox",
                    description: "AI-powered sorting by importance",
                  },
                  sentimentAnalysis: {
                    name: "Sentiment Analysis",
                    description: "Detect tone and urgency in emails",
                  },
                  taskExtraction: {
                    name: "Task Extraction",
                    description: "Extract action items from emails",
                  },
                  meetingDetection: {
                    name: "Meeting Detection",
                    description: "Detect meeting requests in emails",
                  },
                  autoArchive: {
                    name: "Auto-Archive",
                    description: "Automatically archive old/irrelevant emails",
                  },
                }

                const feature = featureNames[key]
                if (!feature) return null

                return (
                  <Card key={key}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <p className="font-medium">{feature.name}</p>
                        <p className="text-sm text-muted-foreground">{feature.description}</p>
                      </div>
                      <Switch
                        checked={value}
                        onCheckedChange={() =>
                          toggleFeature(key as keyof typeof settings.aiFeatures)
                        }
                      />
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            <Separator className="my-6" />

            <h2 className="mb-4 text-lg font-semibold">Agent Configuration</h2>
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4">
                  <Label className="mb-2 block">Priority Threshold</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Emails with priority score above this are marked as important (currently:{" "}
                    {settings.agentConfig?.priorityThreshold || 70})
                  </p>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={settings.agentConfig?.priorityThreshold || 70}
                    onChange={(e) => {
                      const newSettings = {
                        ...settings,
                        agentConfig: {
                          ...settings.agentConfig,
                          priorityThreshold: parseInt(e.target.value) || 70,
                        },
                      }
                      storage.updateSettings(newSettings)
                      setSettings(newSettings)
                    }}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <Label className="mb-2 block">Auto-Archive After Days</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Read emails older than this will be considered for auto-archive (currently:{" "}
                    {settings.agentConfig?.archiveAfterDays || 30} days)
                  </p>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={settings.agentConfig?.archiveAfterDays || 30}
                    onChange={(e) => {
                      const newSettings = {
                        ...settings,
                        agentConfig: {
                          ...settings.agentConfig,
                          archiveAfterDays: parseInt(e.target.value) || 30,
                        },
                      }
                      storage.updateSettings(newSettings)
                      setSettings(newSettings)
                    }}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

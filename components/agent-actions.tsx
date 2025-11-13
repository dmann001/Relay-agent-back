"use client"

import { cn } from "@/lib/utils"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sparkles, Mail, TrendingUp, Zap, Brain, Target, Clock, CheckCircle2, AlertCircle } from "lucide-react"

const agentActions = [
  {
    category: "Email Management",
    icon: Mail,
    actions: [
      {
        name: "Smart Reply Suggestions",
        description: "Generate contextual reply suggestions based on email content and your writing style",
        status: "active" as const,
        usage: "Used 47 times this week",
      },
      {
        name: "Auto-Categorization",
        description: "Automatically categorize incoming emails into custom folders based on content",
        status: "active" as const,
        usage: "Processed 234 emails",
      },
      {
        name: "Priority Inbox",
        description: "AI-powered sorting to surface the most important emails first",
        status: "active" as const,
        usage: "Sorted 156 emails",
      },
    ],
  },
  {
    category: "Productivity",
    icon: Zap,
    actions: [
      {
        name: "Meeting Scheduler",
        description: "Automatically find optimal meeting times and send calendar invites",
        status: "beta" as const,
        usage: "Scheduled 12 meetings",
      },
      {
        name: "Task Extraction",
        description: "Extract action items from emails and create tasks automatically",
        status: "active" as const,
        usage: "Created 28 tasks",
      },
      {
        name: "Follow-up Reminders",
        description: "Set intelligent reminders for emails that need follow-up",
        status: "active" as const,
        usage: "15 active reminders",
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
        usage: "Summarized 89 threads",
      },
      {
        name: "Sentiment Analysis",
        description: "Detect tone and sentiment in incoming emails",
        status: "beta" as const,
        usage: "Analyzed 203 emails",
      },
      {
        name: "Language Translation",
        description: "Automatically translate emails to your preferred language",
        status: "coming-soon" as const,
        usage: "Coming Q1 2025",
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
        usage: "8 active filters",
      },
      {
        name: "Auto-Archive",
        description: "Automatically archive emails based on custom rules",
        status: "active" as const,
        usage: "Archived 145 emails",
      },
      {
        name: "Bulk Actions",
        description: "Perform actions on multiple emails matching specific criteria",
        status: "beta" as const,
        usage: "3 bulk actions this week",
      },
    ],
  },
]

const statusConfig = {
  active: { label: "Active", variant: "default" as const, icon: CheckCircle2, color: "text-green-500" },
  beta: { label: "Beta", variant: "secondary" as const, icon: AlertCircle, color: "text-yellow-500" },
  "coming-soon": { label: "Coming Soon", variant: "outline" as const, icon: Clock, color: "text-muted-foreground" },
}

export function AgentActions() {
  return (
    <div className="flex-1 overflow-auto">
      <div className="border-b border-border px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">AI Agent Actions</h1>
            <p className="text-sm text-muted-foreground">Explore all available AI-powered features and automations</p>
          </div>
        </div>
      </div>

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

                return (
                  <Card key={action.name} className="transition-colors hover:bg-muted/50">
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
                        {action.status !== "coming-soon" && (
                          <Button variant="ghost" size="sm" className="h-8">
                            Configure
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-border bg-muted/30 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="mb-1 font-semibold">Usage Statistics</h3>
            <p className="mb-3 text-sm text-muted-foreground">
              AI agents have processed 847 emails this month, saving you an estimated 12.5 hours of manual work.
            </p>
            <Button variant="outline" size="sm">
              View Detailed Analytics
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

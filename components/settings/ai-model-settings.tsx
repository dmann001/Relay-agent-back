"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { BrainCircuit, Globe2, Loader2, Save, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { SettingsShell } from "@/components/settings/settings-shell"
import { emailApi, type AiModelOption, type AiModelSettings, type AiToolKey } from "@/lib/email-api"
import { useToast } from "@/hooks/use-toast"

const toolRows: Array<{
  key: AiToolKey
  label: string
  description: string
  wired: boolean
}> = [
  {
    key: "webSearch",
    label: "Web search",
    description: "Allow OpenAI to search the web for current information when a prompt needs it.",
    wired: true,
  },
  {
    key: "fileSearch",
    label: "File search",
    description: "OpenAI retrieval over uploaded files. Relay stores the preference for future vector-store integration.",
    wired: false,
  },
  {
    key: "codeInterpreter",
    label: "Code interpreter",
    description: "Run code for analysis-heavy workflows. Relay stores the preference but does not execute sandboxed code yet.",
    wired: false,
  },
  {
    key: "imageGeneration",
    label: "Image generation",
    description: "Generate images from prompts. Relay stores the preference for future compose and attachment workflows.",
    wired: false,
  },
  {
    key: "computerUse",
    label: "Computer use",
    description: "Operate a browser or desktop environment. Relay keeps this disabled until an explicit workflow exists.",
    wired: false,
  },
  {
    key: "mcpConnectors",
    label: "MCP and connectors",
    description: "Connect external tools through MCP. Relay stores the preference for future connector setup.",
    wired: false,
  },
  {
    key: "toolSearch",
    label: "Tool search",
    description: "Let agents discover available tools. Relay stores the preference for future agent workflows.",
    wired: false,
  },
]

const emptySettings: AiModelSettings = {
  defaultModel: "gpt-5.4-mini",
  tools: {
    webSearch: false,
    fileSearch: false,
    codeInterpreter: false,
    imageGeneration: false,
    computerUse: false,
    mcpConnectors: false,
    toolSearch: false,
  },
}

export function AiModelSettingsPage() {
  const [models, setModels] = useState<AiModelOption[]>([])
  const [settings, setSettings] = useState<AiModelSettings>(emptySettings)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  const selectedModel = useMemo(
    () => models.find((model) => model.id === settings.defaultModel),
    [models, settings.defaultModel],
  )

  const loadSettings = useCallback(async () => {
    try {
      const response = await emailApi.getAiModelSettings()
      setModels(response.models)
      setSettings({
        ...emptySettings,
        ...response.settings,
        tools: { ...emptySettings.tools, ...response.settings.tools },
      })
    } catch (error) {
      console.error("[Settings] Failed to load AI model settings:", error)
      toast({
        title: "Could not load AI model settings",
        description: "Refresh the page and try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  const save = async () => {
    setIsSaving(true)
    try {
      const response = await emailApi.updateAiModelSettings(settings)
      setModels(response.models)
      setSettings({
        ...emptySettings,
        ...response.settings,
        tools: { ...emptySettings.tools, ...response.settings.tools },
      })
      toast({
        title: "AI model settings saved",
        description: `${response.settings.defaultModel} is now the default model for Relay AI.`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Apply the latest database migration and try again."
      toast({
        title: "Could not save AI model settings",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <SettingsShell
      title="AI models"
      description="Choose Relay's default OpenAI model and hosted tool permissions."
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading AI models...
        </div>
      ) : (
        <div className="space-y-4">
          <Card className="rounded-xl border border-border bg-card shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft">
                  <BrainCircuit className="h-5 w-5 text-brand-strong" />
                </div>
                <div>
                  <CardTitle className="text-base font-medium">Default model</CardTitle>
                  <CardDescription>
                    Applied to inbox briefs, compose AI, thread chat, summaries, drafts, tasks, and meeting briefs.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="default-ai-model">OpenAI model</Label>
                <select
                  id="default-ai-model"
                  value={settings.defaultModel}
                  onChange={(event) => setSettings((current) => ({ ...current, defaultModel: event.target.value }))}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </div>
              {selectedModel && (
                <p className="rounded-lg border border-border bg-surface-subtle px-3 py-2 text-sm leading-5 text-muted-foreground">
                  {selectedModel.description}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border bg-card shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft">
                  <Wrench className="h-5 w-5 text-brand-strong" />
                </div>
                <div>
                  <CardTitle className="text-base font-medium">OpenAI tools</CardTitle>
                  <CardDescription>
                    Web search is active when enabled. Other OpenAI hosted tools are saved here for future Relay workflows.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="divide-y divide-border rounded-xl border border-border p-0">
              {toolRows.map((tool) => (
                <div key={tool.key} className="flex items-start justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {tool.key === "webSearch" && <Globe2 className="h-4 w-4 text-brand" />}
                      <Label htmlFor={`tool-${tool.key}`} className="text-sm font-medium">
                        {tool.label}
                      </Label>
                      <span className="rounded-full border border-border bg-surface-subtle px-2 py-0.5 text-[11px] text-muted-foreground">
                        {tool.wired ? "Enabled in AI calls" : "Saved preference"}
                      </span>
                    </div>
                    <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">
                      {tool.description}
                    </p>
                  </div>
                  <Switch
                    id={`tool-${tool.key}`}
                    checked={settings.tools[tool.key]}
                    onCheckedChange={(checked) =>
                      setSettings((current) => ({
                        ...current,
                        tools: { ...current.tools, [tool.key]: checked },
                      }))
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={() => void save()} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save model settings
            </Button>
          </div>
        </div>
      )}
    </SettingsShell>
  )
}

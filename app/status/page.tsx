"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, Server } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ServiceStatus {
    status: "connected" | "disconnected" | "error" | "configured" | "unknown"
    message: string
}

interface SystemStatus {
    server: string
    timestamp: string
    env: {
        NODE_ENV: string
    }
    services: {
        supabase: ServiceStatus
        openai: ServiceStatus
    }
}

export default function StatusPage() {
    const [status, setStatus] = useState<SystemStatus | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchStatus = async () => {
        setIsLoading(true)
        setError(null)
        try {
            // Fetch from backend server directly
            // CORS is configured in server/index.ts to allow requests from localhost:3000
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"
            const response = await fetch(`${apiUrl}/status`)

            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}`)
            }

            const data = await response.json()
            setStatus(data)
        } catch (err: any) {
            console.error("Failed to fetch status:", err)
            setError(err.message || "Failed to connect to backend server")
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchStatus()
    }, [])

    const getStatusColor = (status: string) => {
        switch (status) {
            case "connected":
            case "configured":
            case "ok":
                return "bg-green-500/10 text-green-500 hover:bg-green-500/20"
            case "disconnected":
                return "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20"
            case "error":
                return "bg-red-500/10 text-red-500 hover:bg-red-500/20"
            default:
                return "bg-muted text-muted-foreground"
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "connected":
            case "configured":
            case "ok":
                return <CheckCircle2 className="h-5 w-5" />
            case "disconnected":
                return <AlertCircle className="h-5 w-5" />
            case "error":
                return <XCircle className="h-5 w-5" />
            default:
                return <AlertCircle className="h-5 w-5" />
        }
    }

    return (
        <div className="container mx-auto py-10 max-w-2xl">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">System Status</h1>
                    <p className="text-muted-foreground mt-2">
                        Check the health of backend services and connections.
                    </p>
                </div>
                <Button variant="outline" size="icon" onClick={fetchStatus} disabled={isLoading}>
                    <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                </Button>
            </div>

            <div className="grid gap-6">
                {/* Backend Server Status */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div className="space-y-1">
                            <CardTitle className="text-base font-medium">Backend Server</CardTitle>
                            <CardDescription>Core API server connectivity</CardDescription>
                        </div>
                        <Server className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {error ? (
                            <div className="flex items-center gap-2 text-red-500">
                                <XCircle className="h-4 w-4" />
                                <span className="font-medium">Connection Failed</span>
                            </div>
                        ) : isLoading ? (
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <RefreshCw className="h-4 w-4 animate-spin" />
                                <span>Checking...</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-green-500">
                                <CheckCircle2 className="h-4 w-4" />
                                <span className="font-medium">Operational</span>
                                <span className="text-xs text-muted-foreground ml-2">
                                    {new Date(status?.timestamp || "").toLocaleTimeString()}
                                </span>
                            </div>
                        )}
                        {error && (
                            <p className="mt-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                                {error}. Ensure the backend server is running on port 3001.
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Services Status */}
                {status && (
                    <div className="grid gap-4 md:grid-cols-2">
                        {/* Supabase */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Supabase Vector Store</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <Badge variant="secondary" className={getStatusColor(status.services.supabase.status)}>
                                        <span className="flex items-center gap-1.5">
                                            {getStatusIcon(status.services.supabase.status)}
                                            {status.services.supabase.status.toUpperCase()}
                                        </span>
                                    </Badge>
                                </div>
                                <p className="mt-3 text-sm text-muted-foreground">
                                    {status.services.supabase.message}
                                </p>
                            </CardContent>
                        </Card>

                        {/* OpenAI */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">OpenAI Integration</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <Badge variant="secondary" className={getStatusColor(status.services.openai.status)}>
                                        <span className="flex items-center gap-1.5">
                                            {getStatusIcon(status.services.openai.status)}
                                            {status.services.openai.status.toUpperCase()}
                                        </span>
                                    </Badge>
                                </div>
                                <p className="mt-3 text-sm text-muted-foreground">
                                    {status.services.openai.message}
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    )
}

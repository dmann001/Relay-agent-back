"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
    Mail,
    Search,
    PenLine,
    ArrowRight,
    CheckCircle2,
    X,
    ChevronLeft,
    Sparkles,
    Zap,
    Command,
    Clock
} from "lucide-react"
import { Button } from "@/components/ui/button"

// --- TYPES ---

type ScenarioId = 'triage' | 'draft' | 'search'

interface Scenario {
    id: ScenarioId
    title: string
    description: string
    icon: React.ElementType
    duration: string
    color: string
}

const SCENARIOS: Scenario[] = [
    {
        id: 'triage',
        title: "Morning Brief",
        description: "Experience how the agent filters noise and highlights critical decisions.",
        icon: Sparkles,
        duration: "45s",
        color: "#FF5F57"
    },
    {
        id: 'search',
        title: "Semantic Recall",
        description: "Find complex information instantly with natural language queries.",
        icon: Search,
        duration: "30s",
        color: "#FEBC2E"
    },
    {
        id: 'draft',
        title: "Ghostwriter",
        description: "Watch the agent draft professional responses in your unique voice.",
        icon: PenLine,
        duration: "40s",
        color: "#28C840"
    }
]

export default function PreviewPage() {
    const [activeScenario, setActiveScenario] = useState<ScenarioId | null>(null)

    return (
        <div className="min-h-screen bg-[#0A0A0B] text-[#FAFAF9] selection:bg-[#E8DCC4]/20 overflow-hidden font-sans relative">
            {/* Background Ambience */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="bg-grain opacity-[0.03]" />
                <div className="absolute top-[-20%] left-[-10%] w-[1000px] h-[1000px] opacity-10 blur-[120px] bg-[radial-gradient(circle_at_50%_50%,#C4A052,transparent_60%)]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[1200px] h-[1200px] opacity-10 blur-[150px] bg-[radial-gradient(circle_at_50%_50%,#2A2A35,transparent_70%)]" />
            </div>

            <AnimatePresence mode="wait">
                {!activeScenario ? (
                    <SelectionView key="selection" onSelect={setActiveScenario} />
                ) : (
                    <SimulationView
                        key="simulation"
                        scenarioId={activeScenario}
                        onExit={() => setActiveScenario(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}

// --- SELECTION VIEW ---

function SelectionView({ onSelect }: { onSelect: (id: ScenarioId) => void }) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5 }}
            className="relative z-10 container mx-auto px-6 h-screen flex flex-col items-center justify-center"
        >
            <div className="absolute top-6 left-6">
                <Link href="/" className="flex items-center gap-2 group text-[#8A8A8A] hover:text-[#FAFAF9] transition-colors">
                    <div className="p-2 rounded-full bg-white/[0.03] border border-white/[0.05] group-hover:bg-[#C4A052] group-hover:text-[#0A0A0B] transition-colors">
                        <ChevronLeft className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium">Back to Home</span>
                </Link>
            </div>

            <div className="text-center mb-16 space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FAFAF9]/[0.03] border border-[#FAFAF9]/[0.08]">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#C4A052] animate-pulse" />
                    <span className="text-[10px] font-mono tracking-[0.2em] text-[#C4A052] uppercase">
                        System Simulation
                    </span>
                </div>
                <h1 className="text-4xl md:text-6xl font-light tracking-tight text-[#FAFAF9]">
                    Select an <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C4A052] via-[#E8DCC4] to-[#C4A052]">Agent Module</span>
                </h1>
                <p className="text-[#8A8A8A] text-lg max-w-xl mx-auto font-light">
                    Initialize a secure sandbox environment to test the agent's core capabilities in real-time.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl">
                {SCENARIOS.map((scenario) => (
                    <button
                        key={scenario.id}
                        onClick={() => onSelect(scenario.id)}
                        className="group relative p-1 rounded-[24px] bg-gradient-to-b from-white/[0.08] to-transparent hover:from-[#C4A052]/40 transition-all duration-500 text-left"
                    >
                        <div className="absolute inset-0 bg-white/[0.02] rounded-[24px] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <div className="relative h-full bg-[#0F0F11]/90 backdrop-blur-xl border border-white/[0.05] rounded-[23px] p-8 flex flex-col gap-6 overflow-hidden group-hover:border-[#C4A052]/30 transition-colors">

                            {/* Icon */}
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FAFAF9]/10 to-transparent border border-white/[0.05] flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                                <scenario.icon className="w-6 h-6 text-[#FAFAF9]" />
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-xl font-medium text-[#FAFAF9]">{scenario.title}</h3>
                                <p className="text-sm text-[#8A8A8A] leading-relaxed">
                                    {scenario.description}
                                </p>
                            </div>

                            <div className="mt-auto pt-6 border-t border-white/[0.04] flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs text-[#5A5A5A] font-mono uppercase tracking-wider">
                                    <Clock className="w-3 h-3" />
                                    {scenario.duration}
                                </div>
                                <div className="flex items-center gap-2 text-[#C4A052] opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all duration-300">
                                    <span className="text-xs font-medium">Initialize</span>
                                    <ArrowRight className="w-3 h-3" />
                                </div>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </motion.div>
    )
}

// --- SIMULATION VIEW (Placeholder for now) ---

// --- SIMULATION VIEW ---

function SimulationView({ scenarioId, onExit }: { scenarioId: ScenarioId, onExit: () => void }) {
    const [step, setStep] = useState(0)
    const [messages, setMessages] = useState<{ role: 'user' | 'agent', text: any }[]>([])
    const [inputValue, setInputValue] = useState("")
    const [isTyping, setIsTyping] = useState(false)
    const [isAgentThinking, setIsAgentThinking] = useState(false)
    const [emails, setEmails] = useState<any[]>([])
    const [activePanel, setActivePanel] = useState<'list' | 'email' | 'search'>('list')
    const [completed, setCompleted] = useState(false)

    const scrollRef = useRef<HTMLDivElement>(null)

    // Scroll to bottom of chat
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages, isAgentThinking])

    // INITIALIZATION & RUNNER
    useEffect(() => {
        const timeoutIds: NodeJS.Timeout[] = []

        // Reset state
        setStep(0)
        setMessages([])
        setInputValue("")
        setCompleted(false)
        setIsAgentThinking(false)
        if (scenarioId === 'triage') {
            setEmails([
                { id: 1, from: "Stripe", subject: "Payment Dispute #4421", time: "10:02 AM", priority: "critical", preview: "Customer claims they didn't receive..." },
                { id: 2, from: "Alex (Board)", subject: "Q3 Board Deck Review", time: "09:45 AM", priority: "high", preview: "Can we push the review to..." },
                { id: 3, from: "Linear", subject: "Digest: 14 issues", time: "08:00 AM", priority: "low", preview: "New issues assigned to you..." },
                { id: 4, from: "Newsletter", subject: "Tech Weekly", time: "07:30 AM", priority: "low", preview: "The latest in AI..." },
                { id: 5, from: "Cloudflare", subject: "Invoice #9921", time: "06:15 AM", priority: "low", preview: "Your monthly invoice is ready..." }
            ])
            setActivePanel('list')
        } else if (scenarioId === 'search') {
            setActivePanel('list') // empty list initially
            setEmails([])
        } else if (scenarioId === 'draft') {
            setActivePanel('email')
            setEmails([{ id: 1, from: "Sarah Connors", subject: "Project Timeline", time: "11:20 AM", body: "Hey, are we still on track for the launch next Tuesday? Need to know by EOD." }])
        }

        const runStep = (delay: number, fn: () => void) => {
            const id = setTimeout(fn, delay)
            timeoutIds.push(id)
        }

        // SCENARIO SCRIPTS
        if (scenarioId === 'triage') {
            // Step 1: Start
            runStep(500, () => setMessages([{ role: 'agent', text: "Syncing 2 inboxes..." }]))
            // Step 2: Analysis
            runStep(1500, () => {
                setMessages(prev => [...prev.slice(0, -1), { role: 'agent', text: "Analyzed 5 new items. 1 critical issue requiring attention." }])
            })
            // Step 3: Action
            runStep(3000, () => {
                setMessages(prev => [...prev, { role: 'user', text: "Show me the critical item and archive the rest." }])
            })
            // Step 4: Execute
            runStep(4500, () => {
                setIsAgentThinking(true)
            })
            runStep(6000, () => {
                setIsAgentThinking(false)
                setEmails(prev => prev.filter(e => e.priority === 'critical'))
                setMessages(prev => [...prev, { role: 'agent', text: "Done. Archived 4 low-priority items. Here is the Stripe dispute." }])
                setCompleted(true)
            })
        }

        else if (scenarioId === 'search') {
            // Step 1: User types
            runStep(500, () => {
                const text = "Find the PDF about the Q3 budget"
                let i = 0
                setIsTyping(true)
                const type = setInterval(() => {
                    setInputValue(text.substring(0, i + 1))
                    i++
                    if (i === text.length) {
                        clearInterval(type)
                        setIsTyping(false)
                    }
                }, 50)
                timeoutIds.push(setTimeout(() => clearInterval(type), 3000) as any) // safety cleanup
            })
            // Step 2: Submit
            runStep(2500, () => {
                setMessages(prev => [...prev, { role: 'user', text: "Find the PDF about the Q3 budget" }])
                setInputValue("")
                setIsAgentThinking(true)
            })
            // Step 3: Result
            runStep(4000, () => {
                setIsAgentThinking(false)
                setEmails([
                    { id: 1, from: "Finance Team", subject: "Q3 Final Budget.pdf", time: "Oct 12", priority: "high", preview: "Attached is the final version..." },
                    { id: 2, from: "Alex", subject: "Re: Budget questions", time: "Oct 10", priority: "normal", preview: "I think the Q3 budget is..." }
                ])
                setMessages(prev => [...prev, { role: 'agent', text: "Found 2 confident matches from October." }])
                setCompleted(true)
            })
        }

        else if (scenarioId === 'draft') {
            // Step 1: Context
            runStep(500, () => setMessages([{ role: 'agent', text: "Drafting a reply to Sarah..." }]))
            // Step 2: User input shorthand
            runStep(1500, () => {
                const text = "Tell her we are delayed by 2 days due to API issues"
                let i = 0
                setIsTyping(true)
                const type = setInterval(() => {
                    setInputValue(text.substring(0, i + 1))
                    i++
                    if (i === text.length) {
                        clearInterval(type)
                        setIsTyping(false)
                    }
                }, 40)
                timeoutIds.push(setTimeout(() => clearInterval(type), 3000) as any)
            })
            // Step 3: Submit shorthand
            runStep(4000, () => {
                setMessages(prev => [...prev, { role: 'user', text: "Tell her we are delayed by 2 days due to API issues" }])
                setInputValue("")
                setIsAgentThinking(true)
            })
            // Step 4: Expand
            runStep(6000, () => {
                setIsAgentThinking(false)
                setMessages(prev => [...prev,
                {
                    role: 'agent',
                    text: (
                        <div className="flex flex-col gap-2">
                            <span className="text-[#C4A052] text-xs uppercase tracking-wider">Draft Generated</span>
                            <div className="p-3 bg-white/[0.05] rounded-md text-sm text-[#FAFAF9]/80 italic">
                                "Hi Sarah, We've hit a small snag with the API integration which will push the launch back by 2 days. We're now targeting Thursday morning. Thanks for understanding."
                            </div>
                        </div>
                    )
                }
                ])
                setCompleted(true)
            })
        }

        return () => timeoutIds.forEach(clearTimeout)
    }, [scenarioId])


    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-20 h-screen w-full flex items-center justify-center p-4 md:p-8"
        >
            {/* Container */}
            <div className="w-full max-w-5xl h-[80vh] bg-[#0F0F11] border border-white/[0.08] rounded-2xl flex overflow-hidden shadow-2xl shadow-black/50 relative">

                {/* Sidebar (Visual only) */}
                <div className="w-64 bg-[#0A0A0B] border-r border-white/[0.05] hidden md:flex flex-col p-4 gap-4">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                        <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
                        <div className="w-3 h-3 rounded-full bg-[#28C840]" />
                    </div>
                    <div className="space-y-1">
                        <div className="p-2 rounded-lg bg-white/[0.05] text-[#FAFAF9] text-sm font-medium flex items-center gap-2"><Mail className="w-4 h-4" /> Inbox</div>
                        <div className="p-2 rounded-lg text-[#8A8A8A] text-sm hover:text-[#FAFAF9] flex items-center gap-2"><PenLine className="w-4 h-4" /> Drafts</div>
                        <div className="p-2 rounded-lg text-[#8A8A8A] text-sm hover:text-[#FAFAF9] flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Done</div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col min-w-0 bg-[#0F0F11]">

                    {/* Header */}
                    <div className="h-14 border-b border-white/[0.05] flex items-center justify-between px-6">
                        <span className="text-sm font-mono text-[#5A5A5A]">System // {scenarioId.toUpperCase()}</span>
                        <button onClick={onExit} className="text-xs text-[#8A8A8A] hover:text-[#FAFAF9] transition-colors flex items-center gap-1">
                            <X className="w-3 h-3" /> EXIT DEMO
                        </button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

                        {/* List/Panel Area (Left on split, or full) */}
                        <div className="flex-1 p-4 overflow-y-auto space-y-2 border-r border-white/[0.05]">
                            {/* Search Bar Visual */}
                            <div className="mb-4 relative">
                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#5A5A5A]" />
                                <div className="w-full h-9 bg-[#0A0A0B] border border-white/[0.1] rounded-lg pl-9 flex items-center text-sm text-[#8A8A8A]">
                                    {scenarioId === 'search' && isTyping ? inputValue : (scenarioId === 'search' ? "Search..." : "Filter emails...")}
                                    {scenarioId === 'search' && isTyping && <span className="w-0.5 h-4 bg-[#C4A052] animate-pulse ml-0.5" />}
                                </div>
                            </div>

                            {/* Email List Items */}
                            <AnimatePresence>
                                {emails.map((email) => (
                                    <motion.div
                                        key={email.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                                        className={`p-3 rounded-xl border border-white/[0.05] bg-[#0A0A0B]/50 hover:bg-[#0A0A0B] cursor-default transition-colors group ${email.priority === 'critical' ? 'border-l-2 border-l-[#FF5F57]' : ''}`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-sm font-medium text-[#FAFAF9]">{email.from}</span>
                                            <span className="text-xs text-[#5A5A5A]">{email.time}</span>
                                        </div>
                                        <div className="text-sm text-[#FAFAF9]/80 mb-1">{email.subject}</div>
                                        <div className="text-xs text-[#8A8A8A] line-clamp-1">{email.preview || email.body}</div>
                                    </motion.div>
                                ))}
                                {emails.length === 0 && scenarioId === 'triage' && completed && (
                                    <div className="flex flex-col items-center justify-center h-40 text-[#5A5A5A]">
                                        <CheckCircle2 className="w-8 h-8 mb-2 opacity-50" />
                                        <span className="text-sm">Inbox Zero</span>
                                    </div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Agent Chat Area (Right side) */}
                        <div className="w-full md:w-80 bg-[#0A0A0B]/30 flex flex-col border-l border-white/[0.05]">
                            <div className="flex-1 p-4 overflow-y-auto space-y-4" ref={scrollRef}>
                                {messages.map((msg, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${msg.role === 'agent' ? 'bg-[#C4A052] text-[#0A0A0B]' : 'bg-[#333] text-[#FAFAF9]'}`}>
                                            {msg.role === 'agent' ? <Sparkles className="w-4 h-4" /> : <div className="w-2 h-2 rounded-full bg-white" />}
                                        </div>
                                        <div className={`p-3 rounded-2xl text-sm max-w-[85%] ${msg.role === 'agent' ? 'bg-[#1A1A1E] text-[#FAFAF9] rounded-tl-none' : 'bg-[#FAFAF9] text-[#0A0A0B] rounded-tr-none'}`}>
                                            {msg.text}
                                        </div>
                                    </motion.div>
                                ))}
                                {isAgentThinking && (
                                    <div className="flex gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-[#C4A052]/20 flex items-center justify-center shrink-0">
                                            <Sparkles className="w-4 h-4 text-[#C4A052] animate-pulse" />
                                        </div>
                                        <div className="p-3 rounded-2xl bg-[#1A1A1E] rounded-tl-none flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#8A8A8A] animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#8A8A8A] animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#8A8A8A] animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Input Area */}
                            <div className="p-4 border-t border-white/[0.05]">
                                <div className="relative">
                                    <input
                                        readOnly
                                        value={scenarioId !== 'search' ? inputValue : ""}
                                        placeholder={scenarioId === 'search' ? "Search is active above..." : "Type a command..."}
                                        className="w-full h-10 bg-[#0A0A0B] border border-white/[0.1] rounded-lg px-3 text-sm text-[#FAFAF9] placeholder:text-[#5A5A5A] focus:outline-none focus:border-[#C4A052]/50"
                                    />
                                    {completed && (
                                        <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center rounded-lg">
                                            <button onClick={onExit} className="px-4 py-1.5 bg-[#C4A052] hover:bg-[#D4B062] text-[#0A0A0B] text-xs font-bold uppercase tracking-wider rounded-md shadow-lg shadow-[#C4A052]/20 transition-all">
                                                Return to Menu
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Scanlines Overlay */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.02]" style={{ background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 2px, 3px 100%' }} />

            </div>
        </motion.div>
    )
}

"use client"

import { ReactNode } from "react"

interface LandingThemeWrapperProps {
    children: ReactNode
    className?: string
    showOrbs?: boolean
}

export function LandingThemeWrapper({
    children,
    className = "",
    showOrbs = true
}: LandingThemeWrapperProps) {
    return (
        <div className={`min-h-screen bg-[#0A0A0B] text-[#FAFAF9] selection:bg-[#E8DCC4]/20 ${className}`}>
            {/* Noise Texture Overlay */}
            <div
                className="fixed inset-0 pointer-events-none opacity-[0.015] z-50"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                }}
            />

            {/* Ambient Gradient Orbs */}
            {showOrbs && (
                <div className="fixed inset-0 overflow-hidden pointer-events-none">
                    <div
                        className="absolute w-[800px] h-[800px] rounded-full blur-[150px] opacity-20"
                        style={{
                            background: 'radial-gradient(circle, #E8DCC4 0%, transparent 70%)',
                            top: '-20%',
                            left: '-10%',
                        }}
                    />
                    <div
                        className="absolute w-[600px] h-[600px] rounded-full blur-[120px] opacity-10"
                        style={{
                            background: 'radial-gradient(circle, #C4A052 0%, transparent 70%)',
                            bottom: '-10%',
                            right: '-5%',
                        }}
                    />
                </div>
            )}

            {/* Content */}
            <div className="relative z-10">
                {children}
            </div>
        </div>
    )
}

// Reusable glass card component
export function GlassCard({
    children,
    className = "",
    hover = false
}: {
    children: ReactNode
    className?: string
    hover?: boolean
}) {
    return (
        <div className={`
      relative p-[1px] rounded-2xl 
      bg-gradient-to-b from-white/[0.08] to-transparent 
      ${hover ? 'hover:from-white/[0.12] transition-all duration-300' : ''}
    `}>
            <div
                className={`
          relative h-full rounded-2xl overflow-hidden
          ${className}
        `}
                style={{
                    background: 'linear-gradient(180deg, rgba(20,20,22,0.95) 0%, rgba(10,10,11,0.98) 100%)',
                    backdropFilter: 'blur(40px)',
                }}
            >
                {children}
            </div>
        </div>
    )
}

// Accent button matching landing page
export function AccentButton({
    children,
    className = "",
    variant = "primary",
    ...props
}: {
    children: ReactNode
    className?: string
    variant?: 'primary' | 'secondary' | 'ghost'
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
    const variants = {
        primary: "bg-gradient-to-b from-[#FAFAF9] to-[#E8E8E6] hover:from-[#FFFFFF] hover:to-[#F5F5F3] text-[#0A0A0B] font-medium shadow-lg shadow-white/10",
        secondary: "bg-[#E8DCC4] hover:bg-[#F5EDD8] text-[#0A0A0B] font-medium",
        ghost: "text-[#FAFAF9] hover:text-[#FAFAF9] hover:bg-white/[0.03] border border-white/[0.08]",
    }

    return (
        <button
            className={`
        rounded-xl px-5 py-2.5 text-sm 
        transition-all duration-300 
        hover:scale-[1.02] active:scale-[0.98]
        ${variants[variant]}
        ${className}
      `}
            {...props}
        >
            {children}
        </button>
    )
}

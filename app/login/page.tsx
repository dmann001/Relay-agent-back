"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Loader2, Mail, ArrowLeft, ArrowRight, Check, Shield, Eye, EyeOff } from "lucide-react"
import { getAuthStoragePreference, setAuthStoragePreference, supabase } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import Link from "next/link"

const signInSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  rememberMe: z.boolean().optional(),
})

const signUpSchema = z
  .object({
    fullName: z.string().trim().max(100, "Name is too long").optional(),
    email: z.string().email("Enter a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Password must be at least 8 characters"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  })

type SignInValues = z.infer<typeof signInSchema>
type SignUpValues = z.infer<typeof signUpSchema>

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [isSigningUp, setIsSigningUp] = useState(false)
  const [isSigningInWithGoogle, setIsSigningInWithGoogle] = useState(false)
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin")
  const [isLoaded, setIsLoaded] = useState(false)
  const [showSignInPassword, setShowSignInPassword] = useState(false)
  const [isForgotOpen, setIsForgotOpen] = useState(false)

  const signInForm = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "", rememberMe: true },
  })

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    getAuthStoragePreference()
    signInForm.setValue("rememberMe", false)
  }, [signInForm])

  const signUpForm = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" },
  })

  const handleSignIn = async (values: SignInValues) => {
    setIsSigningIn(true)
    try {
      setAuthStoragePreference(!!values.rememberMe)
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      })
      if (error) {
        const errorMessage = error.message?.toLowerCase()
        if (
          error.status === 0 ||
          errorMessage?.includes("failed to fetch") ||
          errorMessage?.includes("network")
        ) {
          toast({
            title: "Auth service unavailable",
            description: "We could not reach the authentication service. Please try again in a moment.",
            variant: "destructive",
          })
          return
        }
        if (error.message?.toLowerCase().includes("email not confirmed")) {
          toast({
            title: "Confirm your email",
            description: "Please check your inbox and confirm your email before signing in.",
            variant: "destructive",
          })
          return
        }
        throw error
      }
      router.replace("/inbox")
    } catch (error: any) {
      const errorMessage = error?.message?.toLowerCase?.() ?? ""
      if (errorMessage.includes("failed to fetch") || errorMessage.includes("network")) {
        toast({
          title: "Auth service unavailable",
          description: "We could not reach the authentication service. Please try again in a moment.",
          variant: "destructive",
        })
        return
      }
      toast({
        title: "Sign in failed",
        description: error.message || "Please check your credentials and try again.",
        variant: "destructive",
      })
    } finally {
      setIsSigningIn(false)
    }
  }

  const handleSignUp = async (values: SignUpValues) => {
    setIsSigningUp(true)
    try {
      const emailRedirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/login` : undefined

      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          emailRedirectTo,
          data: values.fullName ? { full_name: values.fullName } : undefined,
        },
      })

      if (error) {
        throw error
      }

      if (!data.session) {
        toast({
          title: "Check your inbox",
          description: "Confirm your email to finish signing up.",
        })
        return
      }

      router.replace("/inbox")
    } catch (error: any) {
      toast({
        title: "Sign up failed",
        description: error.message || "Please try again with a different email.",
        variant: "destructive",
      })
    } finally {
      setIsSigningUp(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setIsSigningInWithGoogle(true)
    try {
      setAuthStoragePreference(!!signInForm.getValues("rememberMe"))
      const redirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/inbox` : undefined

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      })

      if (error) {
        throw error
      }
    } catch (error: any) {
      toast({
        title: "Google sign in failed",
        description: error.message || "Please try again in a moment.",
        variant: "destructive",
      })
    } finally {
      setIsSigningInWithGoogle(false)
    }
  }

  const handleForgotPassword = () => {
    toast({
      title: "Reset link requested",
      description: "This is a UI-only flow for now. Wire it to Supabase when ready.",
    })
    setIsForgotOpen(false)
  }

  return (
    <div className="h-screen bg-[#0A0A0B] text-[#FAFAF9] selection:bg-[#E8DCC4]/20 overflow-hidden relative">
      {/* Living Void Background: Deep Noir with Gold Mesh (Matching Landing Page) */}
      <div className="fixed inset-0 bg-[#030303] overflow-hidden pointer-events-none">
        {/* Cinematic Grain Overlay handled by globals.css .bg-grain */}
        <div className="bg-grain" />

        {/* Primary Ambient Glow - Golden Hour */}
        <div
          className="absolute top-[-20%] left-[-10%] w-[1000px] h-[1000px] opacity-20 blur-[120px]"
          style={{
            background: 'radial-gradient(circle at 50% 50%, #C4A052, transparent 60%)',
          }}
        />

        {/* Secondary Deep Purple/Blue fill for contrast */}
        <div
          className="absolute bottom-[-20%] right-[-10%] w-[1200px] h-[1200px] opacity-10 blur-[150px]"
          style={{
            background: 'radial-gradient(circle at 50% 50%, #2A2A35, transparent 70%)',
          }}
        />

        {/* Floating Particles/Dust */}
        <div className="absolute inset-0 opacity-20" style={{ backgroundSize: '4px 4px', backgroundImage: 'radial-gradient(#C4A052 1px, transparent 0)' }} />
      </div>

      {/* Back Button - Precision Style */}
      <div className={`absolute top-8 left-8 z-20 transition-all duration-700 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <Button
          asChild
          variant="ghost"
          className="text-[#8A8A8A] hover:text-[#FAFAF9] hover:bg-[#FAFAF9]/5 rounded-full border border-[#FAFAF9]/10 hover:border-[#C4A052]/30 transition-all duration-300 group"
        >
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back to Relay
          </Link>
        </Button>
      </div>

      <div className="relative w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 h-full">
        {/* Left Side: Feature Showcase */}
        <div className="hidden lg:flex flex-col justify-center items-start p-12 relative">
          <div className={`space-y-8 transition-all duration-1000 delay-300 ${isLoaded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}>
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="absolute inset-0 bg-[#E8DCC4] blur-lg opacity-40 group-hover:opacity-60 transition-opacity" />
                <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#E8DCC4] to-[#C4A052]">
                  <Mail className="h-6 w-6 text-[#0A0A0B]" />
                </div>
              </div>
              <span className="text-2xl font-semibold tracking-tight">Relay</span>
            </Link>

            {/* Headline */}
            <div className="space-y-3">
              <h1 className="text-3xl md:text-4xl font-light tracking-[-0.03em] leading-[1.1]">
                Your Gmail inbox
                <br />
                <span className="text-[#5A5A5A]">in one focused client.</span>
              </h1>
              <p className="text-base text-[#8A8A8A] max-w-md leading-relaxed font-light">
                Read, organize, draft, and send Gmail messages without leaving Relay.
              </p>
            </div>

            {/* Feature List */}
            <div className="space-y-3">
              {[
                { icon: Mail, text: "Inbox, sent, drafts, archive, and trash", color: "from-[#E8DCC4] to-[#C4A052]" },
                { icon: Check, text: "Compose, reply, attachments, and Gmail sync", color: "from-[#FEBC2E] to-[#FF9500]" },
                { icon: Shield, text: "Server-side OAuth token handling", color: "from-[#28C840] to-[#1E9432]" },
              ].map((feature, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08] transition-all duration-300"
                >
                  <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${feature.color} flex items-center justify-center shrink-0`}>
                    <feature.icon className="h-4 w-4 text-[#0A0A0B]" />
                  </div>
                  <span className="text-sm font-medium text-[#C4C4C4]">{feature.text}</span>
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* Right Side: Form */}
        <div className="flex flex-col justify-center px-8 sm:px-10 lg:px-12 py-8 relative overflow-hidden">
          <div className={`w-full max-w-md mx-auto space-y-6 transition-all duration-1000 delay-150 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {/* Mobile Logo */}
            <div className="lg:hidden flex items-center justify-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#E8DCC4] to-[#C4A052]">
                <Mail className="h-5 w-5 text-[#0A0A0B]" />
              </div>
              <span className="text-xl font-semibold tracking-tight">Relay</span>
            </div>

            {/* Form Header */}
            <div className="text-center lg:text-left space-y-2">
              <h2 className="text-2xl md:text-3xl font-light tracking-tight">
                {activeTab === "signin" ? "Welcome back" : "Create your account"}
              </h2>
              <p className="text-[#8A8A8A] text-sm">
                {activeTab === "signin"
                  ? "Sign in to manage your Gmail inbox."
                  : "Start your journey to inbox zero."}
              </p>
            </div>

            {/* Obsidian Glass Card Container */}
            <div className="relative group">
              {/* Ambient Glow */}
              <div className="absolute -inset-1 bg-gradient-to-b from-[#C4A052]/20 to-transparent opacity-20 blur-xl group-hover:opacity-30 transition-opacity duration-1000" />

              <div className="relative rounded-[32px] bg-[#0F0F11] border border-[#FAFAF9]/[0.05] overflow-hidden p-[1px]">
                <div className="relative rounded-[31px] bg-[#0A0A0B]/90 backdrop-blur-xl p-8 overflow-hidden">
                  {/* Inner Texture */}
                  <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-repeat opacity-[0.04] pointer-events-none" />

                  {/* Tab Switcher - Precision */}
                  <div className="flex p-1.5 rounded-full bg-[#FAFAF9]/[0.03] border border-[#FAFAF9]/[0.05] mb-8 relative z-10">
                    <button
                      onClick={() => setActiveTab("signin")}
                      className={`flex-1 py-3 px-4 rounded-full text-sm font-medium transition-all duration-300 ${activeTab === "signin"
                        ? "bg-[#FAFAF9]/10 text-[#FAFAF9] shadow-[0_0_20px_rgba(255,255,255,0.05)] border border-[#FAFAF9]/5"
                        : "text-[#8A8A8A] hover:text-[#FAFAF9]"
                        }`}
                    >
                      Sign in
                    </button>
                    <button
                      onClick={() => setActiveTab("signup")}
                      className={`flex-1 py-3 px-4 rounded-full text-sm font-medium transition-all duration-300 ${activeTab === "signup"
                        ? "bg-[#FAFAF9]/10 text-[#FAFAF9] shadow-[0_0_20px_rgba(255,255,255,0.05)] border border-[#FAFAF9]/5"
                        : "text-[#8A8A8A] hover:text-[#FAFAF9]"
                        }`}
                    >
                      Create account
                    </button>
                  </div>

                  {/* Sign In Form */}
                  {activeTab === "signin" && (
                    <Form {...signInForm}>
                      <form onSubmit={signInForm.handleSubmit(handleSignIn)} className="space-y-4">
                        {/* Google Sign In */}
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full h-11 bg-white/[0.03] border-white/[0.08] text-[#FAFAF9] hover:bg-white/[0.06] hover:border-white/[0.12] rounded-xl transition-all duration-200"
                          onClick={handleGoogleSignIn}
                          disabled={isSigningInWithGoogle}
                        >
                          {isSigningInWithGoogle ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Connecting...
                            </>
                          ) : (
                            <span className="flex items-center">
                              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                              </svg>
                              Continue with Google
                            </span>
                          )}
                        </Button>

                        {/* Divider */}
                        <div className="flex items-center gap-4">
                          <div className="h-px flex-1 bg-white/[0.06]" />
                          <span className="text-xs text-[#5A5A5A] uppercase tracking-wider">or</span>
                          <div className="h-px flex-1 bg-white/[0.06]" />
                        </div>

                        <FormField
                          control={signInForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs uppercase tracking-wider text-[#8A8A8A] font-medium">Email</FormLabel>
                              <FormControl>
                                <Input
                                  type="email"
                                  placeholder="you@company.com"
                                  {...field}
                                  className="h-11 bg-white/[0.03] border-white/[0.06] text-[#FAFAF9] placeholder:text-[#5A5A5A] focus:border-[#E8DCC4]/30 focus:ring-1 focus:ring-[#E8DCC4]/20 rounded-xl transition-all"
                                />
                              </FormControl>
                              <FormMessage className="text-red-400" />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={signInForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center justify-between">
                                <FormLabel className="text-xs uppercase tracking-wider text-[#8A8A8A] font-medium">Password</FormLabel>
                                <Dialog open={isForgotOpen} onOpenChange={setIsForgotOpen}>
                                  <DialogTrigger asChild>
                                    <button
                                      type="button"
                                      className="text-xs text-[#E8DCC4] hover:text-[#F5EDD8] transition-colors"
                                    >
                                      Forgot?
                                    </button>
                                  </DialogTrigger>
                                  <DialogContent className="bg-[#0F0F11] border border-white/[0.08] text-[#FAFAF9]">
                                    <DialogHeader>
                                      <DialogTitle>Reset your password</DialogTitle>
                                      <DialogDescription className="text-[#8A8A8A]">
                                        Enter your email and we will send a reset link.
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-2">
                                      <FormLabel className="text-xs uppercase tracking-wider text-[#8A8A8A] font-medium">Email</FormLabel>
                                      <Input
                                        type="email"
                                        placeholder="you@company.com"
                                        className="h-11 bg-white/[0.03] border-white/[0.06] text-[#FAFAF9] placeholder:text-[#5A5A5A] focus:border-[#E8DCC4]/30 focus:ring-1 focus:ring-[#E8DCC4]/20 rounded-xl transition-all"
                                      />
                                    </div>
                                    <DialogFooter>
                                      <Button
                                        type="button"
                                        onClick={handleForgotPassword}
                                        className="bg-gradient-to-b from-[#FAFAF9] to-[#E8E8E6] text-[#0A0A0B]"
                                      >
                                        Send reset link
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                              </div>
                              <FormControl>
                                <div className="relative">
                                  <Input
                                    type={showSignInPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    {...field}
                                    className="h-11 bg-white/[0.03] border-white/[0.06] text-[#FAFAF9] placeholder:text-[#5A5A5A] focus:border-[#E8DCC4]/30 focus:ring-1 focus:ring-[#E8DCC4]/20 rounded-xl transition-all pr-11"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowSignInPassword((prev) => !prev)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A8A8A] hover:text-[#FAFAF9] transition-colors"
                                    aria-label={showSignInPassword ? "Hide password" : "Show password"}
                                  >
                                    {showSignInPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  </button>
                                </div>
                              </FormControl>
                              <FormMessage className="text-red-400" />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={signInForm.control}
                          name="rememberMe"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <FormControl>
                                  <Checkbox
                                    checked={!!field.value}
                                    onCheckedChange={(checked) => field.onChange(checked === true)}
                                    className="border-white/[0.15] data-[state=checked]:bg-[#E8DCC4] data-[state=checked]:text-[#0A0A0B]"
                                  />
                                </FormControl>
                                <span className="text-xs text-[#8A8A8A]">Remember me</span>
                              </div>
                            </FormItem>
                          )}
                        />

                        <Button
                          type="submit"
                          className="w-full h-11 bg-gradient-to-b from-[#FAFAF9] to-[#E8E8E6] hover:from-[#FFFFFF] hover:to-[#F5F5F3] text-[#0A0A0B] font-medium rounded-xl shadow-lg shadow-white/10 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                          disabled={isSigningIn}
                        >
                          {isSigningIn ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Signing in...
                            </>
                          ) : (
                            <span className="flex items-center justify-center">
                              Sign in
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </span>
                          )}
                        </Button>
                      </form>
                    </Form>
                  )}

                  {/* Sign Up Form */}
                  {activeTab === "signup" && (
                    <Form {...signUpForm}>
                      <form onSubmit={signUpForm.handleSubmit(handleSignUp)} className="space-y-4">
                        <FormField
                          control={signUpForm.control}
                          name="fullName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs uppercase tracking-wider text-[#8A8A8A] font-medium">Full name</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Jane Doe"
                                  {...field}
                                  className="h-11 bg-white/[0.03] border-white/[0.06] text-[#FAFAF9] placeholder:text-[#5A5A5A] focus:border-[#E8DCC4]/30 focus:ring-1 focus:ring-[#E8DCC4]/20 rounded-xl transition-all"
                                />
                              </FormControl>
                              <FormMessage className="text-red-400" />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={signUpForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs uppercase tracking-wider text-[#8A8A8A] font-medium">Email</FormLabel>
                              <FormControl>
                                <Input
                                  type="email"
                                  placeholder="you@company.com"
                                  {...field}
                                  className="h-11 bg-white/[0.03] border-white/[0.06] text-[#FAFAF9] placeholder:text-[#5A5A5A] focus:border-[#E8DCC4]/30 focus:ring-1 focus:ring-[#E8DCC4]/20 rounded-xl transition-all"
                                />
                              </FormControl>
                              <FormMessage className="text-red-400" />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-3">
                          <FormField
                            control={signUpForm.control}
                            name="password"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs uppercase tracking-wider text-[#8A8A8A] font-medium">Password</FormLabel>
                                <FormControl>
                                  <Input
                                    type="password"
                                    placeholder="••••••"
                                    {...field}
                                    className="h-11 bg-white/[0.03] border-white/[0.06] text-[#FAFAF9] placeholder:text-[#5A5A5A] focus:border-[#E8DCC4]/30 focus:ring-1 focus:ring-[#E8DCC4]/20 rounded-xl transition-all"
                                  />
                                </FormControl>
                                <FormMessage className="text-red-400" />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={signUpForm.control}
                            name="confirmPassword"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs uppercase tracking-wider text-[#8A8A8A] font-medium">Confirm</FormLabel>
                                <FormControl>
                                  <Input
                                    type="password"
                                    placeholder="••••••"
                                    {...field}
                                    className="h-11 bg-white/[0.03] border-white/[0.06] text-[#FAFAF9] placeholder:text-[#5A5A5A] focus:border-[#E8DCC4]/30 focus:ring-1 focus:ring-[#E8DCC4]/20 rounded-xl transition-all"
                                  />
                                </FormControl>
                                <FormMessage className="text-red-400" />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Password Requirements */}
                        <div className="flex items-center gap-2 text-xs text-[#5A5A5A]">
                          <Check className="h-3 w-3 text-[#28C840]" />
                          <span>Minimum 8 characters</span>
                        </div>

                        <Button
                          type="submit"
                          className="w-full h-11 bg-gradient-to-br from-[#E8DCC4] to-[#C4A052] hover:from-[#F5EDD8] hover:to-[#D4B062] text-[#0A0A0B] font-medium rounded-xl shadow-lg shadow-[#E8DCC4]/10 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                          disabled={isSigningUp}
                        >
                          {isSigningUp ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Creating account...
                            </>
                          ) : (
                            "Create account"
                          )}
                        </Button>
                      </form>
                    </Form>
                  )}
                </div>
              </div>

              {/* Terms */}
              <p className="text-center text-xs text-[#5A5A5A] leading-relaxed">
                By continuing, you agree to our{" "}
                <Link href="#" className="text-[#8A8A8A] hover:text-[#FAFAF9] underline underline-offset-2 transition-colors">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="#" className="text-[#8A8A8A] hover:text-[#FAFAF9] underline underline-offset-2 transition-colors">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

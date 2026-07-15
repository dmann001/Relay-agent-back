"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Loader2, Mail, ArrowLeft, ArrowRight, Eye, EyeOff } from "lucide-react"
import { getAuthStoragePreference, setAuthStoragePreference, supabase } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import signInArt from "@/asset_images/im7.png"
import signUpArt from "@/asset_images/im8.png"

const authInputClass = "landing-auth-input border landing-hairline"

const authPanels = {
  signin: {
    image: signInArt,
    imagePosition: "object-[50%_42%]",
    title: "Return to clarity.",
    description: "Pick up where you left off — your inbox, briefs, and commitments.",
  },
  signup: {
    image: signUpArt,
    imagePosition: "object-[50%_45%]",
    title: "Begin with intention.",
    description: "Create an account and connect Gmail or Outlook in minutes.",
  },
} as const

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
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const tabParam = searchParams.get("tab")
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [isSigningUp, setIsSigningUp] = useState(false)
  const [activeTab, setActiveTab] = useState<"signin" | "signup">(
    tabParam === "signup" ? "signup" : "signin",
  )
  const [indicatorReady, setIndicatorReady] = useState(false)
  const [showSignInPassword, setShowSignInPassword] = useState(false)
  const [isForgotOpen, setIsForgotOpen] = useState(false)

  const signInForm = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "", rememberMe: true },
  })

  useEffect(() => {
    getAuthStoragePreference()
    signInForm.setValue("rememberMe", false)
  }, [signInForm])

  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab === "signup") {
      setActiveTab("signup")
    } else if (tab === "signin") {
      setActiveTab("signin")
    }
  }, [searchParams])

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIndicatorReady(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const handleTabChange = (value: string) => {
    setActiveTab(value as "signin" | "signup")
  }

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
    } catch (error: unknown) {
      const err = error as { message?: string }
      const errorMessage = err?.message?.toLowerCase?.() ?? ""
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
        description: err.message || "Please check your credentials and try again.",
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
    } catch (error: unknown) {
      const err = error as { message?: string }
      toast({
        title: "Sign up failed",
        description: err.message || "Please try again with a different email.",
        variant: "destructive",
      })
    } finally {
      setIsSigningUp(false)
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
    <div className="landing-page relative min-h-screen overflow-x-hidden">
      <div className="landing-backdrop" aria-hidden>
        <div className="landing-backdrop-glow landing-backdrop-glow-hero" />
        <div className="landing-backdrop-glow landing-backdrop-glow-principles" />
        <div className="landing-backdrop-grain" />
      </div>

      <div className="absolute inset-x-0 top-0 z-20 px-6 pt-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-neutral-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-neutral-950">
              <Mail className="h-4 w-4" />
            </div>
            <span className="text-base font-semibold text-white">Relay</span>
          </Link>
        </div>
      </div>

      <div className="relative z-10 mx-auto grid min-h-screen lg:grid-cols-2">
        <div className="relative hidden min-h-[280px] overflow-hidden bg-black lg:block lg:min-h-screen">
          <Image
            key={activeTab}
            src={authPanels[activeTab].image}
            alt=""
            fill
            priority
            sizes="50vw"
            className={cn(
              "landing-auth-image landing-auth-image-enter object-cover opacity-90",
              authPanels[activeTab].imagePosition,
            )}
          />
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black via-black/70 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black via-black/85 to-transparent" />
          <div className="absolute inset-y-0 left-0 w-[12%] bg-gradient-to-r from-black to-transparent" />
          <div className="absolute inset-y-0 right-0 w-[8%] bg-gradient-to-l from-black to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-end p-12 xl:p-16">
            <p className="landing-mono-label mb-4 text-neutral-400">
              {activeTab === "signin" ? "Account" : "Get started"}
            </p>
            <h2 className="landing-section-title max-w-md text-[clamp(2rem,3.5vw,3rem)] drop-shadow-[0_4px_24px_rgb(0_0_0/0.9)]">
              {authPanels[activeTab].title}
            </h2>
            <p className="landing-body mt-4 max-w-sm text-sm md:text-base">
              {authPanels[activeTab].description}
            </p>
          </div>
        </div>

        <div className="relative flex min-h-screen flex-col justify-center px-6 py-16 pt-14 lg:px-10 lg:py-20 xl:px-14">
          <div className="landing-auth-bloom" aria-hidden />
          <div className="relative z-10 mx-auto w-full max-w-md">
            <div className="mb-4 flex flex-col items-center gap-2 text-center lg:items-start lg:text-left">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-neutral-950 lg:hidden">
                <Mail className="h-4 w-4" />
              </div>
              <div>
                <p className="landing-mono-label mb-1 text-[10px]">
                  {activeTab === "signin" ? "Sign in" : "Sign up"}
                </p>
                <h1 className="text-xl font-semibold tracking-[-0.03em] text-white sm:text-2xl">
                  {activeTab === "signin" ? "Welcome back" : "Create your account"}
                </h1>
                <p className="landing-body mt-1 hidden text-sm sm:block">
                  {activeTab === "signin"
                    ? "Sign in to your Relay workspace."
                    : "Start with a free account."}
                </p>
              </div>
            </div>

            <div className="landing-auth-glass rounded-2xl p-4 sm:p-5">
          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
          >
            <TabsList className="landing-auth-tabs mb-4 grid h-9 w-full grid-cols-2 rounded-full p-1">
              <div
                aria-hidden
                className={cn(
                  "landing-auth-tab-indicator",
                  activeTab === "signup" && "is-signup",
                  indicatorReady && "is-ready",
                )}
              />
              <TabsTrigger value="signin" className="landing-auth-tab rounded-full text-xs sm:text-sm">
                Sign in
              </TabsTrigger>
              <TabsTrigger value="signup" className="landing-auth-tab rounded-full text-xs sm:text-sm">
                Create account
              </TabsTrigger>
            </TabsList>

            <div className="landing-auth-content-swap">
            <TabsContent value="signin" className="landing-auth-slide-from-left mt-0">
              <Form {...signInForm}>
                <form onSubmit={signInForm.handleSubmit(handleSignIn)} className="space-y-3">
                  <FormField
                    control={signInForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="landing-mono-label text-[10px] text-neutral-400">Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="you@company.com"
                            className={cn(authInputClass, "h-9 text-sm")}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={signInForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <FormLabel className="landing-mono-label text-[10px] text-neutral-400">Password</FormLabel>
                          <Dialog open={isForgotOpen} onOpenChange={setIsForgotOpen}>
                            <DialogTrigger asChild>
                              <button
                                type="button"
                                className="landing-mono-label text-[10px] text-neutral-500 transition-colors hover:text-white"
                              >
                                Forgot?
                              </button>
                            </DialogTrigger>
                            <DialogContent className="border landing-hairline bg-black text-white">
                              <DialogHeader>
                                <DialogTitle className="text-white">Reset your password</DialogTitle>
                                <DialogDescription className="text-neutral-400">
                                  Enter your email and we will send a reset link.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-2">
                                <FormLabel className="landing-mono-label text-[10px] text-neutral-400">Email</FormLabel>
                                <Input type="email" placeholder="you@company.com" className={authInputClass} />
                              </div>
                              <DialogFooter>
                                <Button
                                  type="button"
                                  onClick={handleForgotPassword}
                                  className="rounded-full bg-white text-neutral-950 hover:bg-neutral-200"
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
                              className={cn(authInputClass, "h-9 pr-10 text-sm")}
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setShowSignInPassword((prev) => !prev)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 transition-colors hover:text-white"
                              aria-label={showSignInPassword ? "Hide password" : "Show password"}
                            >
                              {showSignInPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={signInForm.control}
                    name="rememberMe"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Checkbox
                            checked={!!field.value}
                            onCheckedChange={(checked) => field.onChange(checked === true)}
                          />
                        </FormControl>
                        <span className="text-xs text-neutral-500">Remember me</span>
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="h-10 w-full rounded-full bg-white text-neutral-950 hover:bg-neutral-200"
                    disabled={isSigningIn}
                  >
                    {isSigningIn ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        Sign in
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="signup" className="landing-auth-slide-from-right mt-0">
              <Form {...signUpForm}>
                <form onSubmit={signUpForm.handleSubmit(handleSignUp)} className="space-y-3">
                  <FormField
                    control={signUpForm.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="landing-mono-label text-[10px] text-neutral-400">Full name</FormLabel>
                        <FormControl>
                          <Input placeholder="Jane Doe" className={cn(authInputClass, "h-9 text-sm")} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={signUpForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="landing-mono-label text-[10px] text-neutral-400">Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="you@company.com" className={cn(authInputClass, "h-9 text-sm")} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-2.5">
                    <FormField
                      control={signUpForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <FormLabel className="landing-mono-label text-[10px] text-neutral-400">Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••" className={cn(authInputClass, "h-9 text-sm")} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signUpForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <FormLabel className="landing-mono-label text-[10px] text-neutral-400">Confirm</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••" className={cn(authInputClass, "h-9 text-sm")} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <p className="text-[11px] text-neutral-500">Minimum 8 characters</p>

                  <Button
                    type="submit"
                    className="h-10 w-full rounded-full bg-white text-neutral-950 hover:bg-neutral-200"
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
            </TabsContent>
            </div>
          </Tabs>
        </div>

        <p className="landing-body mt-3 text-center text-[11px] leading-snug lg:text-left">
          By continuing, you agree to our{" "}
          <Link href="#" className="text-neutral-400 underline underline-offset-2 transition-colors hover:text-white">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="#" className="text-neutral-400 underline underline-offset-2 transition-colors hover:text-white">
            Privacy Policy
          </Link>
          .
        </p>
          </div>
        </div>
      </div>
    </div>
  )
}

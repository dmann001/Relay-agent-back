"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Instrument_Serif } from "next/font/google"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Loader2, Mail, ArrowLeft, ArrowRight, Check, Eye, EyeOff } from "lucide-react"
import { getAuthStoragePreference, setAuthStoragePreference, supabase } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { ThemeToggleIcon } from "@/components/theme-toggle"
import philosophersTemple from "@/asset_images/3.png"
import contemplativeProfile from "@/asset_images/7.png"

const loginSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
})

const authPanels = {
  signin: {
    image: contemplativeProfile,
    imagePosition: "object-[58%_center]",
    title: "Return to clarity.",
    description: "Pick up where you left off — your inbox, briefs, and commitments.",
  },
  signup: {
    image: philosophersTemple,
    imagePosition: "object-[center_42%]",
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
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [isSigningUp, setIsSigningUp] = useState(false)
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin")
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
    }
  }, [searchParams])

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
    <div className="relative min-h-screen bg-[var(--landing-bg)] text-[var(--landing-fg)]">
      <div className="absolute top-6 left-6 z-20 flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild className="rounded-full bg-white/70 backdrop-blur-sm dark:bg-neutral-900/70">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>
      <div className="absolute top-6 right-6 z-20">
        <ThemeToggleIcon />
      </div>

      <div className="mx-auto grid min-h-screen lg:grid-cols-2">
        <div className="relative hidden min-h-[280px] overflow-hidden lg:block lg:min-h-screen">
          <Image
            src={authPanels[activeTab].image}
            alt=""
            fill
            priority
            sizes="50vw"
            className={cn("object-cover transition-opacity duration-500", authPanels[activeTab].imagePosition)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10" />
          <div className="absolute inset-0 flex flex-col justify-end p-12 xl:p-16">
            <p
              className={cn(
                loginSerif.className,
                "max-w-md text-3xl leading-tight text-white xl:text-4xl",
              )}
            >
              {authPanels[activeTab].title}
            </p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/75 md:text-base">
              {authPanels[activeTab].description}
            </p>
          </div>
        </div>

        <div className="relative flex flex-col justify-center px-6 py-16 lg:px-12 xl:px-16">
          <div className="relative mx-auto w-full max-w-md">
            <div className="pointer-events-none absolute -right-4 -top-8 h-28 w-28 overflow-hidden rounded-full opacity-90 shadow-lg lg:hidden">
              <Image
                src={activeTab === "signin" ? contemplativeProfile : philosophersTemple}
                alt=""
                fill
                sizes="112px"
                className="object-cover"
              />
            </div>

            <div className="mb-8 flex flex-col items-center gap-3 text-center lg:items-start lg:text-left">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-neutral-900 dark:bg-neutral-100">
                <Mail className="h-5 w-5 text-white dark:text-neutral-900" />
              </div>
              <div>
                <h1 className="text-xl font-medium tracking-tight text-neutral-900 dark:text-neutral-50">
                  {activeTab === "signin" ? "Welcome back" : "Create your account"}
                </h1>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  {activeTab === "signin"
                    ? "Sign in to your Relay workspace."
                    : "Start with a free account."}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.12)] dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-[0_12px_40px_-24px_rgba(0,0,0,0.45)]">
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as "signin" | "signup")}
          >
            <TabsList className="mb-6 grid w-full grid-cols-2 rounded-full bg-neutral-100 p-1 dark:bg-neutral-800">
              <TabsTrigger value="signin" className="rounded-full">
                Sign in
              </TabsTrigger>
              <TabsTrigger value="signup" className="rounded-full">
                Create account
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <Form {...signInForm}>
                <form onSubmit={signInForm.handleSubmit(handleSignIn)} className="space-y-4">
                  <FormField
                    control={signInForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="you@company.com"
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
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>Password</FormLabel>
                          <Dialog open={isForgotOpen} onOpenChange={setIsForgotOpen}>
                            <DialogTrigger asChild>
                              <button
                                type="button"
                                className="text-xs text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                              >
                                Forgot?
                              </button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Reset your password</DialogTitle>
                                <DialogDescription>
                                  Enter your email and we will send a reset link.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-2">
                                <FormLabel>Email</FormLabel>
                                <Input type="email" placeholder="you@company.com" />
                              </div>
                              <DialogFooter>
                                <Button type="button" onClick={handleForgotPassword}>
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
                              className="pr-10"
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setShowSignInPassword((prev) => !prev)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
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
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">Remember me</span>
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full rounded-full" disabled={isSigningIn}>
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

            <TabsContent value="signup">
              <Form {...signUpForm}>
                <form onSubmit={signUpForm.handleSubmit(handleSignUp)} className="space-y-4">
                  <FormField
                    control={signUpForm.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full name</FormLabel>
                        <FormControl>
                          <Input placeholder="Jane Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={signUpForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="you@company.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={signUpForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signUpForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                    <Check className="h-3 w-3" />
                    <span>Minimum 8 characters</span>
                  </div>

                  <Button type="submit" className="w-full rounded-full" disabled={isSigningUp}>
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
          </Tabs>
        </div>

        <p className="mt-6 text-center text-xs text-neutral-400 dark:text-neutral-500 lg:text-left">
          By continuing, you agree to our{" "}
          <Link href="#" className="underline underline-offset-2 hover:text-neutral-600 dark:hover:text-neutral-300">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="#" className="underline underline-offset-2 hover:text-neutral-600 dark:hover:text-neutral-300">
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

"use client"

import type React from "react"

import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { ApiError } from "@/features/auth/services/auth-service"
import { strings } from "@/lib/strings"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { validateEmail, validatePassword } from "@/features/auth/utils/auth-validation"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { Separator } from "@/components/ui/separator"

function LoginPageContent() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [touched, setTouched] = useState({ email: false, password: false })
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { signIn, signInWithGoogle } = useAuth()
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const redirectTo = searchParams.get("redirectTo") || "/overview"

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setEmail(value)
    if (touched.email) {
      setEmailError(validateEmail(value))
    }
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setPassword(value)
    if (touched.password) {
      setPasswordError(validatePassword(value))
    }
  }

  const handleEmailBlur = () => {
    setTouched({ ...touched, email: true })
    setEmailError(validateEmail(email))
  }

  const handlePasswordBlur = () => {
    setTouched({ ...touched, password: true })
    setPasswordError(validatePassword(password))
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate all fields before submitting
    const emailValidationError = validateEmail(email)
    const passwordValidationError = validatePassword(password)

    setEmailError(emailValidationError)
    setPasswordError(passwordValidationError)
    setTouched({ email: true, password: true })

    if (emailValidationError || passwordValidationError) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      await signIn({ email, password })
      router.push(redirectTo)
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        setError(error.message)
        return
      }
      setError(strings.auth_generic_error)
    } finally {
      setIsLoading(false)
    }
  }

  const hasValidationErrors = emailError || passwordError
  const isFormValid = email && password && !hasValidationErrors

  return (
    <div className="min-h-screen flex flex-col" suppressHydrationWarning>
      <div className="flex-1 flex">
        {/* Left Side - Form */}
        <div className="flex-1 flex flex-col bg-background p-4 sm:p-6 lg:p-8 xl:p-12">
        {/* Logo */}
        <div className="mb-8 flex justify-center xl:hidden">
          <Link href="/" aria-label="Go to home page">
            <Image
              src="/logo-collectra-02.png"
              alt="Collectra logo"
              width={56}
              height={56}
              className="h-14 w-auto object-contain"
              priority
            />
          </Link>
        </div>

        {/* Form Container - Centered */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-md space-y-6">
            <div className="space-y-2 text-center">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{strings.auth_login_title}</h1>
              <p className="text-sm sm:text-base text-muted-foreground">{strings.auth_login_description}</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground">{strings.auth_email_label}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    required
                    value={email}
                    onChange={handleEmailChange}
                    onBlur={handleEmailBlur}
                    dir="ltr"
                    aria-invalid={Boolean(emailError && touched.email)}
                    aria-describedby={emailError && touched.email ? 'login-email-error' : undefined}
                    className={`bg-muted/50 ${emailError && touched.email ? 'border-destructive' : ''}`}
                  />
                  {emailError && touched.email && (
                    <p id="login-email-error" className="text-sm text-destructive">{emailError}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-foreground">{strings.auth_password_label}</Label>
                    <Link href="/auth/forgot-password" className="text-sm text-primary hover:underline">
                      {strings.auth_forgot_link}
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={handlePasswordChange}
                      onBlur={handlePasswordBlur}
                      placeholder={strings.auth_password_placeholder}
                      aria-invalid={Boolean(passwordError && touched.password)}
                      aria-describedby={passwordError && touched.password ? 'login-password-error' : undefined}
                      className={`bg-muted/50 ${passwordError && touched.password ? 'border-destructive' : ''} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordError && touched.password && (
                    <p id="login-password-error" className="text-sm text-destructive">{passwordError}</p>
                  )}
                </div>

                {error && (
                  <div role="alert" aria-live="polite" className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm">{error}</div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-foreground text-background hover:bg-foreground/90"
                  size="lg"
                  disabled={isLoading || !isFormValid}
                >
                  {isLoading ? strings.auth_login_loading : strings.auth_login_button}
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
              </div>



              <div className="text-center text-sm text-muted-foreground">
                {strings.auth_login_register_prompt}{" "}
                <Link href="/auth/sign-up" className="text-primary hover:underline font-medium">
                  {strings.auth_login_register_link}
                </Link>
              </div>
            </form>
          </div>
        </div>
        </div>

        {/* Right Side - Decorative */}
        <div
          className="hidden xl:flex flex-1 relative items-center justify-center p-12 bg-cover bg-center"
          style={{ backgroundImage: "url('/login.jpg')" }}
        >
          <div className="absolute inset-0 bg-black/70" />
          <Link href="/" aria-label="Go to home page" className="relative z-10">
            <Image
              src="/logo-collectra-02.png"
              alt="Collectra logo"
              width={220}
              height={220}
              className="h-40 w-auto object-contain"
            />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <LoginPageContent />
    </Suspense>
  )
}

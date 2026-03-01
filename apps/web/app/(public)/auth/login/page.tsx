"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { ApiError } from "@/features/auth/services/auth-service"
import { strings } from "@/lib/strings"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { validateEmail, validatePassword } from "@/features/auth/utils/auth-validation"
import { Eye, EyeOff, Loader2, LayoutGrid } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Navbar } from "@/components/common/navbar"
import { Footer } from "@/components/common/footer"

export default function LoginPage() {
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
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex">
        {/* Left Side - Form */}
        <div className="flex-1 flex flex-col bg-background p-4 sm:p-6 lg:p-8 xl:p-12">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-6 lg:mb-8">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LayoutGrid className="h-8 w-8" />
          </div>
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
                    className={`bg-muted/50 ${emailError && touched.email ? 'border-destructive' : ''}`}
                  />
                  {emailError && touched.email && (
                    <p className="text-sm text-destructive">{emailError}</p>
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
                    <p className="text-sm text-destructive">{passwordError}</p>
                  )}
                </div>

                {error && (
                  <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm">{error}</div>
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
                  <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full bg-muted/50"
                size="lg"
                disabled={isGoogleLoading || isLoading}
                onClick={async () => {
                  setIsGoogleLoading(true)
                  try {
                    const callbackUrl = `${window.location.origin}/auth/callback`
                    await signInWithGoogle(callbackUrl)
                  } catch (error) {
                    if (error instanceof ApiError) {
                      setError(error.message)
                    } else {
                      setError(strings.auth_generic_error)
                    }
                    setIsGoogleLoading(false)
                  }
                }}
              >
                {isGoogleLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {strings.auth_google_loading}
                  </>
                ) : (
                  <>
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    {strings.auth_google_continue}
                  </>
                )}
              </Button>

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
        <div className="hidden xl:flex flex-1 bg-muted/50 items-center justify-center p-12">
          <div className="flex h-48 w-48 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <LayoutGrid className="h-24 w-24" />
          </div>
        </div>
      </div>
    </div>
  )
}

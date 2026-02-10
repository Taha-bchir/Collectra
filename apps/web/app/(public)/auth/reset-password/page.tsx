"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle, Eye, EyeOff, Loader2, LayoutGrid } from "lucide-react"
import { ApiError } from "@/features/auth/services/auth-service"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { strings } from "@/lib/strings"
import Link from "next/link"

type ResetState = "verifying" | "ready" | "submitting" | "success" | "error"

export default function ResetPasswordPage() {
  const router = useRouter()
  const { resetPassword } = useAuth()

  const [state, setState] = useState<ResetState>("verifying")
  const [error, setError] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [type, setType] = useState<string | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""))
    const queryParams = new URLSearchParams(window.location.search)

    setAccessToken(hashParams.get("access_token") ?? queryParams.get("access_token"))
    setType(hashParams.get("type") ?? queryParams.get("type"))
    setInitialized(true)
  }, [])

  useEffect(() => {
    if (!initialized) return

    if (!accessToken || type !== "recovery") {
      setState("error")
      setError(strings.auth_reset_invalid_token)
      return
    }

    setState("ready")
  }, [accessToken, initialized, type])

  const validatePasswords = () => {
    if (newPassword.length < 8) return strings.auth_password_min_length
    if (newPassword.length > 72) return strings.auth_password_max_length
    if (newPassword !== confirmPassword) return strings.auth_password_mismatch
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const validationError = validatePasswords()
    if (validationError) {
      setError(validationError)
      return
    }

    if (!accessToken) {
      setError(strings.auth_reset_invalid_token)
      setState("error")
      return
    }

    try {
      setState("submitting")
      await resetPassword({ newPassword, accessToken })
      setState("success")

      setTimeout(() => {
        router.replace("/auth/login")
      }, 1500)
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : strings.auth_generic_error
      setError(message)
      setState("ready")
    }
  }

  const renderIcon = () => {
    if (state === "verifying" || state === "submitting") {
      return <Loader2 className="w-8 h-8 text-primary animate-spin" />
    }
    if (state === "success") {
      return <CheckCircle className="w-8 h-8 text-green-500" />
    }
    return <AlertCircle className="w-8 h-8 text-destructive" />
  }

  const title =
    state === "success"
      ? strings.auth_reset_success_title
      : state === "ready" || state === "submitting"
        ? strings.auth_reset_title
        : state === "verifying"
          ? strings.auth_reset_verifying
          : strings.auth_reset_error_title

  const description =
    state === "success"
      ? strings.auth_reset_success_description
      : state === "ready" || state === "submitting"
        ? strings.auth_reset_description
        : state === "verifying"
          ? strings.auth_reset_verifying_description
          : error ?? strings.auth_reset_error_description

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center bg-background p-4 sm:p-6 relative">
        {/* Logo */}
      <div className="mb-8">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <LayoutGrid className="h-8 w-8" />
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-8 space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {/* Form */}
      <div className="w-full max-w-md space-y-6">
        {(state === "ready" || state === "submitting") && (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-foreground">
                {strings.auth_new_password_label}
              </Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  maxLength={72}
                  required
                  placeholder={strings.auth_password_placeholder}
                  className="bg-muted/50 border-muted pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground"
                  aria-label={showNewPassword ? "Hide password" : "Show password"}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-foreground">
                {strings.auth_confirm_password_label}
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  maxLength={72}
                  required
                  placeholder={strings.auth_password_placeholder}
                  className="bg-muted/50 border-muted pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-destructive flex items-center gap-2">{error}</p>}
            <Button
              className="w-full bg-foreground text-background hover:bg-foreground/90"
              size="lg"
              type="submit"
              disabled={state === "submitting"}
            >
              {state === "submitting"
                ? strings.auth_reset_submitting
                : strings.auth_reset_submit}
            </Button>
          </form>
        )}

        {state === "error" && (
          <div className="text-center space-y-4">
            <p className="text-sm text-destructive">{error}</p>
            <Button asChild variant="outline" className="w-full bg-muted/50 border-muted">
              <Link href="/auth/login">{strings.auth_reset_back_to_login}</Link>
            </Button>
          </div>
        )}

        {state === "success" && (
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              {strings.auth_reset_success_message}
            </p>
            <Button asChild className="w-full bg-foreground text-background hover:bg-foreground/90" size="lg">
              <Link href="/auth/login">{strings.auth_reset_back_to_login}</Link>
            </Button>
          </div>
        )}

        {/* Legal Disclaimer */}
        <p className="text-xs text-muted-foreground text-center">
          By clicking continue, you agree to our{" "}
          <Link href="/terms" className="underline hover:no-underline">
            Terms of Service
          </Link>
          {" "}and{" "}
          <Link href="/privacy" className="underline hover:no-underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
      </div>
    </div>
  )
}

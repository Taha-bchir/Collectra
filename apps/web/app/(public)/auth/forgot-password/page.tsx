"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle, Loader2, LayoutGrid } from "lucide-react"
import { ApiError } from "@/features/auth/services/auth-service"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { strings } from "@/lib/strings"
import { validateEmail } from "@/features/auth/utils/auth-validation"

type Status = "idle" | "submitting" | "success" | "error"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [emailError, setEmailError] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState<string | null>(null)

  const { requestPasswordReset } = useAuth()

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validation = validateEmail(email)
    setEmailError(validation)

    if (validation) return

    setStatus("submitting")
    setError(null)

    try {
      await requestPasswordReset(email)
      setStatus("success")
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : strings.auth_generic_error
      setError(message)
      setStatus("error")
    }
  }

  const isSubmitting = status === "submitting"
  const isSuccess = status === "success"

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
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
          {isSuccess ? strings.auth_forgot_success_title : strings.auth_forgot_title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isSuccess ? strings.auth_forgot_success_description : strings.auth_forgot_description}
        </p>
      </div>

      {/* Form */}
      <div className="w-full max-w-md space-y-6">
        {!isSuccess && (
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">{strings.auth_email_label}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (emailError) setEmailError(null)
                }}
                onBlur={() => setEmailError(validateEmail(email))}
                dir="ltr"
                placeholder="m@example.com"
                className={`bg-muted/50 border-muted text-left ${emailError ? "border-destructive" : ""}`}
                required
              />
              {emailError && <p className="text-sm text-destructive">{emailError}</p>}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              type="submit"
              className="w-full bg-foreground text-background hover:bg-foreground/90"
              size="lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {strings.auth_forgot_submit}
                </>
              ) : (
                strings.auth_forgot_submit
              )}
            </Button>
          </form>
        )}

        {isSuccess && (
          <Button
            className="w-full bg-foreground text-background hover:bg-foreground/90"
            size="lg"
            onClick={() => router.replace("/auth/login")}
          >
            {strings.auth_verify_login_button}
          </Button>
        )}

        {!isSuccess && (
          <div className="text-center text-sm text-muted-foreground">
            <Link href="/auth/login" className="text-primary hover:underline">
              {strings.auth_verify_login_button}
            </Link>
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

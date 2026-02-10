"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { CheckCircle, Loader2, XCircle, LayoutGrid } from "lucide-react"
import { strings } from "@/lib/strings"
import { useRouter } from "next/navigation"

type VerifyState = "verifying" | "success" | "error"

const ALLOWED_TYPES = new Set(["signup", "email_change"])

export default function VerifyPage() {
  const router = useRouter()
  const [state, setState] = useState<VerifyState>("verifying")
  const [initialized, setInitialized] = useState(false)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [type, setType] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""))
    const queryParams = new URLSearchParams(window.location.search)

    setAccessToken(hashParams.get("access_token") ?? queryParams.get("access_token"))
    setType(hashParams.get("type") ?? queryParams.get("type"))
    setInitialized(true)
  }, [])

  useEffect(() => {
    if (!initialized || state !== "verifying") return

    if (!accessToken || (type && !ALLOWED_TYPES.has(type))) {
      setState("error")
      return
    }

    // Supabase already verifies before redirecting; we just acknowledge success and move the user to login.
    setState("success")

    const timeout = setTimeout(() => {
      router.replace("/auth/login")
    }, 1500)

    return () => clearTimeout(timeout)
  }, [accessToken, router, state, type, initialized])

  const renderIcon = () => {
    if (state === "verifying") return <Loader2 className="w-8 h-8 text-primary animate-spin" />
    if (state === "success") return <CheckCircle className="w-8 h-8 text-green-500" />
    return <XCircle className="w-8 h-8 text-destructive" />
  }

  const title =
    state === "success"
      ? strings.auth_verify_success_title
      : state === "verifying"
        ? strings.auth_verify_loading_title
        : strings.auth_verify_error_title

  const description =
    state === "success"
      ? strings.auth_verify_success_description
      : state === "verifying"
        ? strings.auth_verify_loading_description
        : strings.auth_verify_error_description

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

      {/* Content */}
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center">
            {renderIcon()}
          </div>
        </div>

        {state === "success" && (
          <p className="text-sm text-muted-foreground text-center leading-relaxed">
            {strings.auth_verify_success_message}
          </p>
        )}

        {state === "error" && (
          <p className="text-sm text-destructive text-center leading-relaxed">
            {strings.auth_verify_error_cta}
          </p>
        )}

        <Button
          asChild
          className="w-full bg-foreground text-background hover:bg-foreground/90"
          size="lg"
          variant={state === "error" ? "outline" : "default"}
        >
          <Link href="/auth/login">{strings.auth_verify_login_button}</Link>
        </Button>

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

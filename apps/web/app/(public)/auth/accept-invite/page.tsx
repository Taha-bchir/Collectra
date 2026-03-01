"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertCircle, CheckCircle2, LayoutGrid, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { acceptInvitation, ApiError } from "@/features/team/services/team-service"

type InviteState = "loading" | "ready" | "accepting" | "accepted" | "invalid" | "error"

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export default function AcceptInvitePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, hasHydrated } = useAuth()
  const [state, setState] = useState<InviteState>("loading")
  const [token, setToken] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    const invitationToken = searchParams.get("token")?.trim() ?? ""
    setToken(invitationToken)

    if (!invitationToken || !isUuid(invitationToken)) {
      setState("invalid")
      return
    }

    setState("ready")
  }, [searchParams])

  useEffect(() => {
    if (!hasHydrated || !token || !isUuid(token)) return
    if (!isAuthenticated) return
    if (state !== "ready") return

    const run = async () => {
      setState("accepting")
      setError(null)
      try {
        const result = await acceptInvitation(token)
        setSuccessMessage(result.message)
        setState("accepted")
      } catch (inviteError: unknown) {
        const message =
          inviteError instanceof ApiError
            ? inviteError.message
            : inviteError instanceof Error
              ? inviteError.message
              : "Failed to accept invitation"
        setError(message)
        setState("error")
      }
    }

    run()
  }, [hasHydrated, isAuthenticated, token, state])

  useEffect(() => {
    if (state !== "accepted") return
    const timeout = setTimeout(() => {
      router.push("/overview")
    }, 1200)

    return () => clearTimeout(timeout)
  }, [state, router])

  const signUpHref = useMemo(() => {
    if (!token) return "/auth/sign-up"
    return `/auth/sign-up?inviteToken=${encodeURIComponent(token)}&redirectTo=${encodeURIComponent(`/auth/accept-invite?token=${token}`)}`
  }, [token])

  const loginHref = useMemo(() => {
    if (!token) return "/auth/login"
    return `/auth/login?inviteToken=${encodeURIComponent(token)}&redirectTo=${encodeURIComponent(`/auth/accept-invite?token=${token}`)}`
  }, [token])

  const icon =
    state === "loading"
      ? <Loader2 className="w-8 h-8 text-primary animate-spin" />
      : state === "ready" || state === "accepted"
        ? <CheckCircle2 className="w-8 h-8 text-green-500" />
        : state === "accepting"
          ? <Loader2 className="w-8 h-8 text-primary animate-spin" />
        : <AlertCircle className="w-8 h-8 text-destructive" />

  const title =
    state === "loading"
      ? "Validating invitation"
      : state === "accepting"
        ? "Accepting invitation"
        : state === "accepted"
          ? "Invitation accepted"
      : state === "ready"
        ? "You are invited"
        : state === "error"
          ? "Unable to accept invitation"
        : "Invalid invitation link"

  const description =
    state === "loading"
      ? "Please wait while we verify your invitation token."
      : state === "accepting"
        ? "Please wait while we add you to the workspace."
      : state === "accepted"
        ? (successMessage ?? "You have joined the workspace. Redirecting to overview...")
      : state === "ready"
        ? (isAuthenticated
          ? "You are signed in. We will now accept your invitation."
          : "Continue to create your account or sign in to join the workspace.")
        : state === "error"
          ? (error ?? "Failed to accept invitation.")
        : "This invite link is missing a valid token. Ask your manager for a new invitation link."

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center bg-background p-4 sm:p-6 relative">
        <div className="mb-8">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LayoutGrid className="h-8 w-8" />
          </div>
        </div>

        <div className="text-center mb-8 space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        <div className="w-full max-w-md space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
              {icon}
            </div>
          </div>

          {state === "ready" && !isAuthenticated && (
            <div className="space-y-3">
              <Button asChild className="w-full bg-foreground text-background hover:bg-foreground/90" size="lg">
                <Link href={signUpHref}>Create account and accept invite</Link>
              </Button>

              <Button asChild variant="outline" className="w-full bg-muted/50" size="lg">
                <Link href={loginHref}>I already have an account</Link>
              </Button>

              <p className="text-xs text-muted-foreground text-center break-all">
                Invitation token: {token}
              </p>
            </div>
          )}

          {(state === "error" || state === "accepted") && (
            <div className="space-y-3">
              <Button asChild variant="outline" className="w-full bg-muted/50" size="lg">
                <Link href="/overview">Go to overview</Link>
              </Button>
            </div>
          )}

          {state === "invalid" && (
            <div className="space-y-3">
              <Button asChild variant="outline" className="w-full bg-muted/50" size="lg">
                <Link href="/auth/login">Back to login</Link>
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            By continuing, you agree to our{" "}
            <Link href="/terms" className="underline hover:no-underline">Terms of Service</Link>
            {" "}and{" "}
            <Link href="/privacy" className="underline hover:no-underline">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  )
}

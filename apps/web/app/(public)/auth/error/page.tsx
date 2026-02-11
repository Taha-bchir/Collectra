"use client"

import { Suspense } from "react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { AlertCircle, LayoutGrid } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { strings } from "@/lib/strings"

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const errorCode = searchParams.get("error")

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
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{strings.auth_error_title}</h1>
        <p className="text-sm text-muted-foreground">{strings.auth_error_description}</p>
      </div>

      {/* Content */}
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
        </div>

        {errorCode ? (
          <p className="text-sm text-muted-foreground text-center">
            {strings.auth_error_code}: {errorCode}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground text-center">{strings.auth_error_description}</p>
        )}

        <Button asChild className="w-full bg-foreground text-background hover:bg-foreground/90" size="lg">
          <Link href="/auth/login">{strings.auth_signup_success_button}</Link>
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

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="w-full max-w-md">
            <div className="text-center">
              <h1 className="text-2xl font-bold">Loading…</h1>
            </div>
          </div>
        </div>
      }
    >
      <AuthErrorContent />
    </Suspense>
  )
}

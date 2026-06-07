"use client"

import type React from "react"

import { CollectraLogo } from "@/components/common/collectra-logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, Suspense } from "react"
import { ApiError } from "@/features/auth/services/auth-service"
import { strings } from "@/lib/strings"
import { useAuth } from "@/features/auth/hooks/use-auth"
import {
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
  validateFullName,
  validatePhone,
} from "@/features/auth/utils/auth-validation"
import { ChevronRight, ChevronLeft, Loader2 } from "lucide-react"
import { Separator } from "@/components/ui/separator"

interface FieldErrors {
  email: string | null
  password: string | null
  confirmPassword: string | null
  fullName: string | null
  phone: string | null
  workspaceName: string | null
  website: string | null
}

const validateWorkspaceName = (name: string): string | null => {
  if (!name || name.trim().length === 0) return strings.validation_workspace_name_required
  if (name.length > 120) return strings.validation_workspace_name_max_length
  return null
}

const validateWebsite = (website: string): string | null => {
  if (!website) return null
  if (website.length > 255) return strings.validation_workspace_website_max_length
  try {
    const parsed = new URL(website)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return strings.validation_workspace_website_invalid
    }
  } catch {
    return strings.validation_workspace_website_invalid
  }
  return null
}

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

const SIGNUP_DRAFT_STORAGE_KEY = "collectra:signup-draft"

function SignUpForm() {
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [repeatPassword, setRepeatPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [workspaceName, setWorkspaceName] = useState("")
  const [website, setWebsite] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [touched, setTouched] = useState({
    email: false,
    password: false,
    confirmPassword: false,
    fullName: false,
    phone: false,
    workspaceName: false,
    website: false,
  })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({
    email: null,
    password: null,
    confirmPassword: null,
    fullName: null,
    phone: null,
    workspaceName: null,
    website: null,
  })
  const router = useRouter()
  const searchParams = useSearchParams()
  const { signUp, signInWithGoogle } = useAuth()
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const rawInviteToken = searchParams.get("inviteToken")?.trim() ?? ""
  const inviteToken = isUuid(rawInviteToken) ? rawInviteToken : ""
  const hasInviteToken = Boolean(inviteToken)
  const redirectParam = searchParams.get("redirectTo")
  const redirectTo = hasInviteToken && redirectParam?.startsWith("/auth/accept-invite")
    ? "/overview"
    : (redirectParam || "/overview")
  const finalStep = hasInviteToken ? 2 : 3

  useEffect(() => {
    if (typeof window === "undefined") return
    const raw = window.localStorage.getItem(SIGNUP_DRAFT_STORAGE_KEY)
    if (!raw) return

    try {
      const parsed = JSON.parse(raw) as Partial<{
        step: number
        email: string
        fullName: string
        phone: string
        workspaceName: string
        website: string
      }>

      if (parsed.step && parsed.step >= 1 && parsed.step <= finalStep) {
        setStep(parsed.step)
      }
      setEmail(parsed.email ?? "")
      setFullName(parsed.fullName ?? "")
      setPhone(parsed.phone ?? "")
      setWorkspaceName(parsed.workspaceName ?? "")
      setWebsite(parsed.website ?? "")
    } catch {
      window.localStorage.removeItem(SIGNUP_DRAFT_STORAGE_KEY)
    }
  }, [finalStep])

  useEffect(() => {
    if (typeof window === "undefined") return

    const hasDraft = Boolean(email || fullName || phone || workspaceName || website)
    if (!hasDraft) {
      window.localStorage.removeItem(SIGNUP_DRAFT_STORAGE_KEY)
      return
    }

    window.localStorage.setItem(
      SIGNUP_DRAFT_STORAGE_KEY,
      JSON.stringify({
        step,
        email,
        fullName,
        phone,
        workspaceName,
        website,
      }),
    )
  }, [email, fullName, phone, step, website, workspaceName])

  const updateFieldError = (field: keyof FieldErrors, error: string | null) => {
    setFieldErrors((prev) => ({ ...prev, [field]: error }))
  }

  const setFieldTouched = (field: keyof typeof touched) => {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setEmail(value)
    if (touched.email) {
      updateFieldError("email", validateEmail(value))
    }
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setPassword(value)
    if (touched.password) {
      updateFieldError("password", validatePassword(value))
    }
    if (touched.confirmPassword && repeatPassword) {
      updateFieldError("confirmPassword", validatePasswordConfirmation(value, repeatPassword))
    }
  }

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setRepeatPassword(value)
    if (touched.confirmPassword) {
      updateFieldError("confirmPassword", validatePasswordConfirmation(password, value))
    }
  }

  const handleFullNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setFullName(value)
    if (touched.fullName) {
      updateFieldError("fullName", validateFullName(value))
    }
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setPhone(value)
    if (touched.phone) {
      updateFieldError("phone", validatePhone(value))
    }
  }

  const handleWorkspaceNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setWorkspaceName(value)
    if (touched.workspaceName) {
      updateFieldError("workspaceName", validateWorkspaceName(value))
    }
  }

  const handleWebsiteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setWebsite(value)
    if (touched.website) {
      updateFieldError("website", validateWebsite(value))
    }
  }

  const validateStep1 = () => {
    const errors: Partial<FieldErrors> = {
      fullName: validateFullName(fullName),
      email: validateEmail(email),
      phone: validatePhone(phone),
    }

    setFieldErrors((prev) => ({ ...prev, ...errors }))
    setTouched((prev) => ({ ...prev, fullName: true, email: true, phone: true }))

    return !errors.fullName && !errors.email && !errors.phone && fullName && email
  }

  const validateStep2 = () => {
    const errors: Partial<FieldErrors> = {
      password: validatePassword(password),
      confirmPassword: validatePasswordConfirmation(password, repeatPassword),
    }

    setFieldErrors((prev) => ({ ...prev, ...errors }))
    setTouched((prev) => ({
      ...prev,
      password: true,
      confirmPassword: true,
    }))

    return !errors.password && !errors.confirmPassword && password && repeatPassword
  }

  const validateStep3 = () => {
    const errors: Partial<FieldErrors> = {
      workspaceName: validateWorkspaceName(workspaceName),
      website: validateWebsite(website),
    }

    setFieldErrors((prev) => ({ ...prev, ...errors }))
    setTouched((prev) => ({
      ...prev,
      workspaceName: true,
      website: true,
    }))

    return !errors.workspaceName && !errors.website && workspaceName
  }

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2)
      return
    }
    if (step === 2 && !hasInviteToken && validateStep2()) {
      setStep(3)
    }
  }

  const handleBack = () => {
    if (step === 2) {
      setStep(1)
      return
    }
    if (step === 3 && !hasInviteToken) {
      setStep(2)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateStep2()) {
      return
    }

    if (!hasInviteToken && !validateStep3()) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const payload = {
        email,
        password,
        fullName,
        workspaceName: hasInviteToken ? undefined : workspaceName,
        website: hasInviteToken ? undefined : (website.trim() ? website.trim() : undefined),
        inviteToken: hasInviteToken ? inviteToken : undefined,
      } as Parameters<typeof signUp>[0]
      const result = await signUp(payload)
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(SIGNUP_DRAFT_STORAGE_KEY)
      }
      if (result.requiresEmailVerification) {
        router.push("/auth/sign-up-success")
      } else {
        router.push(redirectTo)
      }
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

  const hasValidationErrors = Object.values(fieldErrors).some((error) => error !== null)
  const requiredFieldsFilled = hasInviteToken
    ? Boolean(email && password && repeatPassword && fullName)
    : Boolean(email && password && repeatPassword && fullName && workspaceName)
  const isFormValid = requiredFieldsFilled && !hasValidationErrors

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex">
        {/* Left Side - Form */}
        <div className="flex-1 flex flex-col bg-background p-4 sm:p-6 lg:p-8 xl:p-12 overflow-y-auto">
        {/* Logo */}
        <div className="mb-8 flex justify-center xl:hidden">
          <Link href="/" aria-label="Go to home page">
            <CollectraLogo width={56} height={56} className="h-14 w-auto object-contain" priority />
          </Link>
        </div>

        {/* Form Container - Centered */}
        <div className="flex-1 flex items-start justify-center py-4 lg:py-8">
          <div className="w-full max-w-md space-y-6">
            <div className="space-y-2 text-center">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{strings.auth_signup_title}</h1>
              <p className="text-sm sm:text-base text-muted-foreground">{strings.auth_signup_description}</p>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className={`flex items-center gap-2 ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                  step >= 1 ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground'
                }`}>
                  1
                </div>
                <span className="text-sm font-medium hidden sm:inline">Basic Info</span>
              </div>
              <div className={`h-px w-10 ${step >= 2 ? 'bg-primary' : 'bg-muted-foreground'}`} />
              <div className={`flex items-center gap-2 ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                  step >= 2 ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground'
                }`}>
                  2
                </div>
                <span className="text-sm font-medium hidden sm:inline">Password</span>
              </div>
              {!hasInviteToken && (
                <>
                  <div className={`h-px w-10 ${step >= 3 ? 'bg-primary' : 'bg-muted-foreground'}`} />
                  <div className={`flex items-center gap-2 ${step >= 3 ? 'text-primary' : 'text-muted-foreground'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                      step >= 3 ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground'
                    }`}>
                      3
                    </div>
                    <span className="text-sm font-medium hidden sm:inline">Workspace</span>
                  </div>
                </>
              )}
            </div>

            {hasInviteToken && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
                You are joining via invitation. Your workspace will be assigned automatically.
              </div>
            )}

            <form onSubmit={step === finalStep ? handleSignUp : (e) => { e.preventDefault(); handleNext(); }} className="space-y-4">
              {step === 1 ? (
                /* Step 1: Basic Information */
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-foreground">{strings.auth_full_name_label}</Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder={strings.auth_full_name_placeholder}
                      required
                      value={fullName}
                      onChange={handleFullNameChange}
                      onBlur={() => {
                        setFieldTouched("fullName")
                        updateFieldError("fullName", validateFullName(fullName))
                      }}
                      aria-invalid={Boolean(fieldErrors.fullName && touched.fullName)}
                      aria-describedby={fieldErrors.fullName && touched.fullName ? "signup-fullname-error" : undefined}
                      className={`bg-muted/50 ${fieldErrors.fullName && touched.fullName ? "border-destructive" : ""}`}
                      maxLength={120}
                    />
                    {fieldErrors.fullName && touched.fullName && (
                      <p id="signup-fullname-error" className="text-sm text-destructive">{fieldErrors.fullName}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-foreground">{strings.auth_email_label}</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="m@example.com"
                      required
                      value={email}
                      onChange={handleEmailChange}
                      onBlur={() => {
                        setFieldTouched("email")
                        updateFieldError("email", validateEmail(email))
                      }}
                      dir="ltr"
                      aria-invalid={Boolean(fieldErrors.email && touched.email)}
                      aria-describedby={fieldErrors.email && touched.email ? "signup-email-error" : undefined}
                      className={`bg-muted/50 text-left ${fieldErrors.email && touched.email ? "border-destructive" : ""}`}
                    />
                    {fieldErrors.email && touched.email && (
                      <p id="signup-email-error" className="text-sm text-destructive">{fieldErrors.email}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-foreground">{strings.auth_phone_label}</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder={strings.auth_phone_placeholder}
                      value={phone}
                      onChange={handlePhoneChange}
                      onBlur={() => {
                        setFieldTouched("phone")
                        updateFieldError("phone", validatePhone(phone))
                      }}
                      dir="ltr"
                      aria-invalid={Boolean(fieldErrors.phone && touched.phone)}
                      aria-describedby={fieldErrors.phone && touched.phone ? "signup-phone-error" : undefined}
                      className={`bg-muted/50 text-left ${fieldErrors.phone && touched.phone ? "border-destructive" : ""}`}
                      maxLength={32}
                    />
                    {fieldErrors.phone && touched.phone && (
                      <p id="signup-phone-error" className="text-sm text-destructive">{fieldErrors.phone}</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-foreground text-background hover:bg-foreground/90"
                    size="lg"
                  >
                    Continue
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              ) : step === 2 ? (
                /* Step 2: Password */
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-foreground">{strings.auth_password_label}</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={handlePasswordChange}
                      onBlur={() => {
                        setFieldTouched("password")
                        updateFieldError("password", validatePassword(password))
                      }}
                      placeholder={strings.auth_password_placeholder}
                      aria-invalid={Boolean(fieldErrors.password && touched.password)}
                      aria-describedby={fieldErrors.password && touched.password ? "signup-password-error" : undefined}
                      className={`bg-muted/50 ${fieldErrors.password && touched.password ? "border-destructive" : ""}`}
                      maxLength={72}
                    />
                    {fieldErrors.password && touched.password && (
                      <p id="signup-password-error" className="text-sm text-destructive">{fieldErrors.password}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="repeat-password" className="text-foreground">{strings.auth_password_confirm_label}</Label>
                    <Input
                      id="repeat-password"
                      type="password"
                      required
                      value={repeatPassword}
                      onChange={handleConfirmPasswordChange}
                      onBlur={() => {
                        setFieldTouched("confirmPassword")
                        updateFieldError("confirmPassword", validatePasswordConfirmation(password, repeatPassword))
                      }}
                      aria-invalid={Boolean(fieldErrors.confirmPassword && touched.confirmPassword)}
                      aria-describedby={fieldErrors.confirmPassword && touched.confirmPassword ? "signup-confirm-password-error" : undefined}
                      className={`bg-muted/50 ${fieldErrors.confirmPassword && touched.confirmPassword ? "border-destructive" : ""}`}
                      maxLength={72}
                    />
                    {fieldErrors.confirmPassword && touched.confirmPassword && (
                      <p id="signup-confirm-password-error" className="text-sm text-destructive">{fieldErrors.confirmPassword}</p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 bg-muted/50"
                      size="lg"
                      onClick={handleBack}
                      disabled={isLoading}
                    >
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-foreground text-background hover:bg-foreground/90"
                      size="lg"
                      disabled={hasInviteToken ? (isLoading || !isFormValid) : isLoading}
                    >
                      {hasInviteToken
                        ? (isLoading ? strings.auth_signup_loading : strings.auth_signup_button)
                        : (
                          <>
                            Continue
                            <ChevronRight className="ml-2 h-4 w-4" />
                          </>
                        )}
                    </Button>
                  </div>
                </div>
              ) : (
                /* Step 3: Workspace */
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="workspaceName" className="text-foreground">{strings.auth_workspace_name_label}</Label>
                    <Input
                      id="workspaceName"
                      type="text"
                      required
                      value={workspaceName}
                      onChange={handleWorkspaceNameChange}
                      onBlur={() => {
                        setFieldTouched("workspaceName")
                        updateFieldError("workspaceName", validateWorkspaceName(workspaceName))
                      }}
                      aria-invalid={Boolean(fieldErrors.workspaceName && touched.workspaceName)}
                      aria-describedby={fieldErrors.workspaceName && touched.workspaceName ? "signup-workspace-error" : undefined}
                      placeholder={strings.auth_workspace_name_placeholder}
                      className={`bg-muted/50 ${fieldErrors.workspaceName && touched.workspaceName ? "border-destructive" : ""}`}
                      maxLength={120}
                    />
                    {fieldErrors.workspaceName && touched.workspaceName && (
                      <p id="signup-workspace-error" className="text-sm text-destructive">{fieldErrors.workspaceName}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="website" className="text-foreground">{strings.auth_workspace_website_label}</Label>
                    <Input
                      id="website"
                      type="url"
                      value={website}
                      onChange={handleWebsiteChange}
                      onBlur={() => {
                        setFieldTouched("website")
                        updateFieldError("website", validateWebsite(website))
                      }}
                      aria-invalid={Boolean(fieldErrors.website && touched.website)}
                      aria-describedby={fieldErrors.website && touched.website ? "signup-website-error" : undefined}
                      placeholder={strings.auth_workspace_website_placeholder}
                      className={`bg-muted/50 ${fieldErrors.website && touched.website ? "border-destructive" : ""}`}
                      maxLength={255}
                    />
                    {fieldErrors.website && touched.website && (
                      <p id="signup-website-error" className="text-sm text-destructive">{fieldErrors.website}</p>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 bg-muted/50"
                      size="lg"
                      onClick={handleBack}
                      disabled={isLoading}
                    >
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-foreground text-background hover:bg-foreground/90"
                      size="lg"
                      disabled={isLoading || !isFormValid}
                    >
                      {isLoading ? strings.auth_signup_loading : strings.auth_signup_button}
                    </Button>
                  </div>
                </div>
              )}

              {error && (
                <div role="alert" aria-live="polite" className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm">{error}</div>
              )}

              {step === 1 && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <Separator />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">Or</span>
                    </div>
                  </div>


                </>
              )}

              <div className="text-center text-sm text-muted-foreground">
                {strings.auth_signup_login_prompt}{" "}
                <Link href="/auth/login" className="text-primary hover:underline font-medium">
                  {strings.auth_signup_login_link}
                </Link>
              </div>
            </form>
          </div>
        </div>
        </div>

        {/* Right Side - Decorative */}
        <div
          className="hidden xl:flex flex-1 relative items-center justify-center p-12 bg-cover bg-center"
          style={{ backgroundImage: "url('/register.jpg')" }}
        >
          <div className="absolute inset-0 bg-black/80" />
          <Link href="/" aria-label="Go to home page" className="relative z-10">
            <CollectraLogo width={220} height={220} className="h-40 w-auto object-contain" />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <SignUpForm />
    </Suspense>
  )
}

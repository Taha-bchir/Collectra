"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, Suspense } from "react"
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
import { ChevronRight, ChevronLeft, Loader2, LayoutGrid } from "lucide-react"
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
  const redirectTo = searchParams.get("redirectTo") || "/overview"

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
    if (step === 2 && validateStep2()) {
      setStep(3)
    }
  }

  const handleBack = () => {
    if (step === 2) {
      setStep(1)
      return
    }
    if (step === 3) {
      setStep(2)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateStep3()) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const payload = {
        email,
        password,
        fullName,
        workspaceName,
        website: website.trim() ? website.trim() : undefined,
      } as Parameters<typeof signUp>[0]
      const result = await signUp(payload)
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
  const requiredFieldsFilled = email && password && repeatPassword && fullName && workspaceName
  const isFormValid = requiredFieldsFilled && !hasValidationErrors

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex">
        {/* Left Side - Form */}
        <div className="flex-1 flex flex-col bg-background p-4 sm:p-6 lg:p-8 xl:p-12 overflow-y-auto">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-6 lg:mb-8">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LayoutGrid className="h-8 w-8" />
          </div>
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
              <div className={`h-px w-10 ${step >= 3 ? 'bg-primary' : 'bg-muted-foreground'}`} />
              <div className={`flex items-center gap-2 ${step >= 3 ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                  step >= 3 ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground'
                }`}>
                  3
                </div>
                <span className="text-sm font-medium hidden sm:inline">Workspace</span>
              </div>
            </div>

            <form onSubmit={step === 3 ? handleSignUp : (e) => { e.preventDefault(); handleNext(); }} className="space-y-4">
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
                      className={`bg-muted/50 ${fieldErrors.fullName && touched.fullName ? "border-destructive" : ""}`}
                      maxLength={120}
                    />
                    {fieldErrors.fullName && touched.fullName && (
                      <p className="text-sm text-destructive">{fieldErrors.fullName}</p>
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
                      className={`bg-muted/50 text-left ${fieldErrors.email && touched.email ? "border-destructive" : ""}`}
                    />
                    {fieldErrors.email && touched.email && (
                      <p className="text-sm text-destructive">{fieldErrors.email}</p>
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
                      className={`bg-muted/50 text-left ${fieldErrors.phone && touched.phone ? "border-destructive" : ""}`}
                      maxLength={32}
                    />
                    {fieldErrors.phone && touched.phone && (
                      <p className="text-sm text-destructive">{fieldErrors.phone}</p>
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
                      className={`bg-muted/50 ${fieldErrors.password && touched.password ? "border-destructive" : ""}`}
                      maxLength={72}
                    />
                    {fieldErrors.password && touched.password && (
                      <p className="text-sm text-destructive">{fieldErrors.password}</p>
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
                      className={`bg-muted/50 ${fieldErrors.confirmPassword && touched.confirmPassword ? "border-destructive" : ""}`}
                      maxLength={72}
                    />
                    {fieldErrors.confirmPassword && touched.confirmPassword && (
                      <p className="text-sm text-destructive">{fieldErrors.confirmPassword}</p>
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
                      disabled={isLoading}
                    >
                      Continue
                      <ChevronRight className="ml-2 h-4 w-4" />
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
                      placeholder={strings.auth_workspace_name_placeholder}
                      className={`bg-muted/50 ${fieldErrors.workspaceName && touched.workspaceName ? "border-destructive" : ""}`}
                      maxLength={120}
                    />
                    {fieldErrors.workspaceName && touched.workspaceName && (
                      <p className="text-sm text-destructive">{fieldErrors.workspaceName}</p>
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
                      placeholder={strings.auth_workspace_website_placeholder}
                      className={`bg-muted/50 ${fieldErrors.website && touched.website ? "border-destructive" : ""}`}
                      maxLength={255}
                    />
                    {fieldErrors.website && touched.website && (
                      <p className="text-sm text-destructive">{fieldErrors.website}</p>
                    )}
                  </div>

                  {error && (
                    <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm">{error}</div>
                  )}

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

              {step === 1 && (
                <>
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
        <div className="hidden xl:flex flex-1 bg-muted/50 items-center justify-center p-12">
          <div className="flex h-48 w-48 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <LayoutGrid className="h-24 w-24" />
          </div>
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

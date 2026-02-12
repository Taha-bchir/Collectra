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
  validateStreetAddress,
  validateCity,
  validateState,
  validatePostalCode,
  validateCountry,
} from "@/features/auth/utils/auth-validation"
import { ChevronRight, ChevronLeft, Loader2, LayoutGrid } from "lucide-react"
import { Separator } from "@/components/ui/separator"

interface FieldErrors {
  email: string | null
  password: string | null
  confirmPassword: string | null
  fullName: string | null
  phone: string | null
  streetAddress: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  country: string | null
}

function SignUpForm() {
  const searchParams = useSearchParams()
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [repeatPassword, setRepeatPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [streetAddress, setStreetAddress] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [postalCode, setPostalCode] = useState("")
  const [country, setCountry] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [touched, setTouched] = useState({
    email: false,
    password: false,
    confirmPassword: false,
    fullName: false,
    phone: false,
    streetAddress: false,
    city: false,
    state: false,
    postalCode: false,
    country: false,
  })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({
    email: null,
    password: null,
    confirmPassword: null,
    fullName: null,
    phone: null,
    streetAddress: null,
    city: null,
    state: null,
    postalCode: null,
    country: null,
  })
  const router = useRouter()
  const { signUp, signInWithGoogle } = useAuth()
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

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

  const handleStreetAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setStreetAddress(value)
    if (touched.streetAddress) {
      updateFieldError("streetAddress", validateStreetAddress(value))
    }
  }

  const handleCityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setCity(value)
    if (touched.city) {
      updateFieldError("city", validateCity(value))
    }
  }

  const handleStateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setState(value)
    if (touched.state) {
      updateFieldError("state", validateState(value))
    }
  }

  const handlePostalCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setPostalCode(value)
    if (touched.postalCode) {
      updateFieldError("postalCode", validatePostalCode(value))
    }
  }

  const handleCountryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setCountry(value)
    if (touched.country) {
      updateFieldError("country", validateCountry(value))
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
      streetAddress: validateStreetAddress(streetAddress),
      city: validateCity(city),
      state: validateState(state),
      postalCode: validatePostalCode(postalCode),
      country: validateCountry(country),
      password: validatePassword(password),
      confirmPassword: validatePasswordConfirmation(password, repeatPassword),
    }

    setFieldErrors((prev) => ({ ...prev, ...errors }))
    setTouched((prev) => ({
      ...prev,
      streetAddress: true,
      city: true,
      state: true,
      postalCode: true,
      country: true,
      password: true,
      confirmPassword: true,
    }))

    return (
      !errors.streetAddress &&
      !errors.city &&
      !errors.state &&
      !errors.postalCode &&
      !errors.country &&
      !errors.password &&
      !errors.confirmPassword &&
      password &&
      repeatPassword
    )
  }

  const handleNext = () => {
    if (validateStep1()) {
      setStep(2)
    }
  }

  const handleBack = () => {
    setStep(1)
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateStep2()) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      await signUp({
        email,
        password,
        fullName,
      })
      router.push("/auth/sign-up-success")
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
  const requiredFieldsFilled = email && password && repeatPassword && fullName
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
              <div className={`h-px w-12 ${step >= 2 ? 'bg-primary' : 'bg-muted-foreground'}`} />
              <div className={`flex items-center gap-2 ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                  step >= 2 ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground'
                }`}>
                  2
                </div>
                <span className="text-sm font-medium hidden sm:inline">Address & Password</span>
              </div>
            </div>

            <form onSubmit={step === 2 ? handleSignUp : (e) => { e.preventDefault(); handleNext(); }} className="space-y-4">
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
              ) : (
                /* Step 2: Address & Password */
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="streetAddress" className="text-foreground">{strings.auth_street_address_label}</Label>
                    <Input
                      id="streetAddress"
                      type="text"
                      placeholder={strings.auth_street_address_placeholder}
                      value={streetAddress}
                      onChange={handleStreetAddressChange}
                      onBlur={() => {
                        setFieldTouched("streetAddress")
                        updateFieldError("streetAddress", validateStreetAddress(streetAddress))
                      }}
                      className={`bg-muted/50 ${fieldErrors.streetAddress && touched.streetAddress ? "border-destructive" : ""}`}
                      maxLength={255}
                    />
                    {fieldErrors.streetAddress && touched.streetAddress && (
                      <p className="text-sm text-destructive">{fieldErrors.streetAddress}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city" className="text-foreground">{strings.auth_city_label}</Label>
                      <Input
                        id="city"
                        type="text"
                        placeholder={strings.auth_city_placeholder}
                        value={city}
                        onChange={handleCityChange}
                        onBlur={() => {
                          setFieldTouched("city")
                          updateFieldError("city", validateCity(city))
                        }}
                        className={`bg-muted/50 ${fieldErrors.city && touched.city ? "border-destructive" : ""}`}
                        maxLength={120}
                      />
                      {fieldErrors.city && touched.city && (
                        <p className="text-sm text-destructive">{fieldErrors.city}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state" className="text-foreground">{strings.auth_state_label}</Label>
                      <Input
                        id="state"
                        type="text"
                        placeholder={strings.auth_state_placeholder}
                        value={state}
                        onChange={handleStateChange}
                        onBlur={() => {
                          setFieldTouched("state")
                          updateFieldError("state", validateState(state))
                        }}
                        className={`bg-muted/50 ${fieldErrors.state && touched.state ? "border-destructive" : ""}`}
                        maxLength={120}
                      />
                      {fieldErrors.state && touched.state && (
                        <p className="text-sm text-destructive">{fieldErrors.state}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="postalCode" className="text-foreground">{strings.auth_postal_code_label}</Label>
                      <Input
                        id="postalCode"
                        type="text"
                        placeholder={strings.auth_postal_code_placeholder}
                        value={postalCode}
                        onChange={handlePostalCodeChange}
                        onBlur={() => {
                          setFieldTouched("postalCode")
                          updateFieldError("postalCode", validatePostalCode(postalCode))
                        }}
                        className={`bg-muted/50 ${fieldErrors.postalCode && touched.postalCode ? "border-destructive" : ""}`}
                        maxLength={20}
                      />
                      {fieldErrors.postalCode && touched.postalCode && (
                        <p className="text-sm text-destructive">{fieldErrors.postalCode}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country" className="text-foreground">{strings.auth_country_label}</Label>
                      <Input
                        id="country"
                        type="text"
                        placeholder={strings.auth_country_placeholder}
                        value={country}
                        onChange={handleCountryChange}
                        onBlur={() => {
                          setFieldTouched("country")
                          updateFieldError("country", validateCountry(country))
                        }}
                        className={`bg-muted/50 ${fieldErrors.country && touched.country ? "border-destructive" : ""}`}
                        maxLength={120}
                      />
                      {fieldErrors.country && touched.country && (
                        <p className="text-sm text-destructive">{fieldErrors.country}</p>
                      )}
                    </div>
                  </div>

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

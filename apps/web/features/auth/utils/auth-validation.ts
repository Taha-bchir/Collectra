/**
 * Validation utilities for authentication forms
 * Matches the validation rules from the API schema
 */

import { strings } from '@/lib/strings'

export interface ValidationError {
  field: string
  message: string
}

export const validateEmail = (email: string): string | null => {
  if (!email) return strings.validation_email_required
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) return strings.validation_email_invalid
  return null
}

export const validatePassword = (password: string): string | null => {
  if (!password) return strings.validation_password_required
  if (password.length < 8) return strings.validation_password_min_length
  if (password.length > 72) return strings.validation_password_max_length
  return null
}

export const validatePasswordConfirmation = (
  password: string,
  confirmation: string,
): string | null => {
  if (!confirmation) return strings.validation_password_confirm_required
  if (password !== confirmation) return strings.validation_password_confirm_mismatch
  return null
}

export const validateFullName = (fullName: string): string | null => {
  if (!fullName || fullName.trim().length === 0) return strings.validation_fullname_required
  if (fullName.length > 120) return strings.validation_fullname_max_length
  return null
}

export const validatePhone = (phone: string): string | null => {
  if (!phone) return null
  if (phone.length < 3) return strings.validation_phone_min_length
  if (phone.length > 32) return strings.validation_phone_max_length
  return null
}

export const validateStreetAddress = (address: string): string | null => {
  if (!address) return null
  if (address.length > 255) return strings.validation_street_address_max_length
  return null
}

export const validateCity = (city: string): string | null => {
  if (!city) return null
  if (city.length > 120) return strings.validation_city_max_length
  return null
}

export const validateState = (state: string): string | null => {
  if (!state) return null
  if (state.length > 120) return strings.validation_state_max_length
  return null
}

export const validatePostalCode = (postalCode: string): string | null => {
  if (!postalCode) return null
  if (postalCode.length > 20) return strings.validation_postal_code_max_length
  return null
}

export const validateCountry = (country: string): string | null => {
  if (!country) return null
  if (country.length > 120) return strings.validation_country_max_length
  return null
}

export const validateLoginForm = (email: string, password: string): ValidationError[] => {
  const errors: ValidationError[] = []
  const emailError = validateEmail(email)
  if (emailError) errors.push({ field: 'email', message: emailError })
  const passwordError = validatePassword(password)
  if (passwordError) errors.push({ field: 'password', message: passwordError })
  return errors
}

export interface RegisterFormData {
  email: string
  password: string
  confirmPassword: string
  fullName: string
  phone?: string
  streetAddress?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
}

export const validateRegisterForm = (data: RegisterFormData): ValidationError[] => {
  const errors: ValidationError[] = []
  const emailError = validateEmail(data.email)
  if (emailError) errors.push({ field: 'email', message: emailError })
  const passwordError = validatePassword(data.password)
  if (passwordError) errors.push({ field: 'password', message: passwordError })
  const confirmError = validatePasswordConfirmation(data.password, data.confirmPassword)
  if (confirmError) errors.push({ field: 'confirmPassword', message: confirmError })
  const fullNameError = validateFullName(data.fullName)
  if (fullNameError) errors.push({ field: 'fullName', message: fullNameError })
  if (data.phone) {
    const e = validatePhone(data.phone)
    if (e) errors.push({ field: 'phone', message: e })
  }
  if (data.streetAddress) {
    const e = validateStreetAddress(data.streetAddress)
    if (e) errors.push({ field: 'streetAddress', message: e })
  }
  if (data.city) {
    const e = validateCity(data.city)
    if (e) errors.push({ field: 'city', message: e })
  }
  if (data.state) {
    const e = validateState(data.state)
    if (e) errors.push({ field: 'state', message: e })
  }
  if (data.postalCode) {
    const e = validatePostalCode(data.postalCode)
    if (e) errors.push({ field: 'postalCode', message: e })
  }
  if (data.country) {
    const e = validateCountry(data.country)
    if (e) errors.push({ field: 'country', message: e })
  }
  return errors
}

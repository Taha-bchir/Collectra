'use client'

import { useCallback } from 'react'
import { useAuthStore } from '@/store/auth-store'

export function useAuth() {
  const profile = useAuthStore((state) => state.profile)
  const hasHydrated = useAuthStore((state) => state.hasHydrated)
  const authLoading = useAuthStore((state) => state.authLoading)
  const authError = useAuthStore((state) => state.authError)
  const signIn = useAuthStore((state) => state.signIn)
  const signUp = useAuthStore((state) => state.signUp)
  const signOut = useAuthStore((state) => state.signOut)
  const requestPasswordReset = useAuthStore((state) => state.requestPasswordReset)
  const resetPassword = useAuthStore((state) => state.resetPassword)
  const getGoogleOAuthUrl = useAuthStore((state) => state.getGoogleOAuthUrl)
  const handleGoogleCallback = useAuthStore((state) => state.handleGoogleCallback)
  const handleGoogleTokens = useAuthStore((state) => state.handleGoogleTokens)

  const signInWithGoogle = useCallback(async (redirectTo?: string) => {
    const url = await getGoogleOAuthUrl(redirectTo)
    window.location.href = url
  }, [getGoogleOAuthUrl])

  return {
    profile,
    hasHydrated,
    isAuthenticated: hasHydrated && Boolean(profile),
    authLoading,
    authError,
    signIn,
    signUp,
    signOut,
    requestPasswordReset,
    resetPassword,
    signInWithGoogle,
    handleGoogleCallback,
    handleGoogleTokens,
  }
}

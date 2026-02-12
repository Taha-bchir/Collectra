"use client"

import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ThemeSwitcher } from "@/components/common/theme-switcher"
import { strings } from "@/lib/strings"
import { useAuth } from "@/features/auth/hooks/use-auth"

export function DashboardHeader() {
  const router = useRouter()
  const { profile, signOut } = useAuth()

  if (!profile) {
    return null
  }

  const handleLogout = () => {
    signOut()
    router.push("/auth/login")
  }

  return (
    <header className="sticky top-0 z-40 border-b from-background/95 to-background/80 backdrop-blur-lg border-border/30 shadow-sm">
      <div className="flex h-16 items-center justify-between px-6 lg:px-8 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm text-muted-foreground truncate">{profile.email}</span>
        </div>

        <div className="flex items-center gap-2 lg:gap-4 ml-auto">
          <ThemeSwitcher />

          <Button
            variant="ghost"
            onClick={handleLogout}
            className="hover:bg-destructive/10 hover:text-destructive transition-all duration-200 text-foreground/70"
          >
            <span className="hidden sm:inline">{strings.logout}</span>
            <LogOut className="w-5 h-5 ml-2 shrink-0" />
          </Button>
        </div>
      </div>
    </header>
  )
}

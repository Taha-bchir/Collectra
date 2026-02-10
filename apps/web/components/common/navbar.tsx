"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Menu, Sun, Moon, Monitor, LayoutGrid } from "lucide-react"
import { useState, useEffect } from "react"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { usePreferencesStore } from "@/store/preferences-store"
import { strings } from "@/lib/strings"
import { useRouter } from "next/navigation"

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const { isAuthenticated, profile, signOut } = useAuth()
  const theme = usePreferencesStore((state) => state.theme)
  const setTheme = usePreferencesStore((state) => state.setTheme)
  const router = useRouter()

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const getUserInitials = () => {
    if (profile?.email) {
      return profile.email.substring(0, 2).toUpperCase()
    }
    return "U"
  }

  const handleLogout = () => {
    signOut()
    router.push("/")
  }

  const getThemeIcon = () => {
    if (theme === "light") return <Sun className="h-4 w-4" />
    if (theme === "dark") return <Moon className="h-4 w-4" />
    return <Monitor className="h-4 w-4" />
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
              aria-label={strings.app_name}
            >
              <LayoutGrid className="h-6 w-6" />
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {strings.nav_home}
            </Link>
            <Link
              href="/privacy"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {strings.footer_privacy_policy}
            </Link>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {isMounted && (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" aria-label={strings.theme}>
                      {getThemeIcon()}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => setTheme("light")}
                      className={theme === "light" ? "bg-accent" : ""}
                    >
                      <Sun className="mr-2 h-4 w-4" />
                      {strings.lightMode}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setTheme("dark")}
                      className={theme === "dark" ? "bg-accent" : ""}
                    >
                      <Moon className="mr-2 h-4 w-4" />
                      {strings.darkMode}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setTheme("system")}
                      className={theme === "system" ? "bg-accent" : ""}
                    >
                      <Monitor className="mr-2 h-4 w-4" />
                      {strings.systemMode}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {!isAuthenticated ? (
                  <>
                    <Button variant="ghost" asChild>
                      <Link href="/auth/login">{strings.nav_login}</Link>
                    </Button>
                    <Button asChild>
                      <Link href="/auth/sign-up">{strings.nav_get_started}</Link>
                    </Button>
                  </>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {getUserInitials()}
                          </AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium leading-none">
                            {profile?.email?.split("@")[0] || "User"}
                          </p>
                          <p className="text-xs leading-none text-muted-foreground">
                            {profile?.email || ""}
                          </p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/overview">{strings.nav_dashboard}</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/settings/account">{strings.nav_account_settings}</Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout}>{strings.logout}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </>
            )}
          </div>

          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t">
            <nav className="flex flex-col gap-4">
              <Link
                href="/"
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                {strings.nav_home}
              </Link>
              <Link
                href="/privacy"
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                {strings.footer_privacy_policy}
              </Link>
              <div className="flex items-center gap-2 pt-2">
                {isMounted && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" aria-label={strings.theme} className="bg-transparent">
                        {getThemeIcon()}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setTheme("light")} className={theme === "light" ? "bg-accent" : ""}>
                        <Sun className="mr-2 h-4 w-4" />
                        {strings.lightMode}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme("dark")} className={theme === "dark" ? "bg-accent" : ""}>
                        <Moon className="mr-2 h-4 w-4" />
                        {strings.darkMode}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme("system")} className={theme === "system" ? "bg-accent" : ""}>
                        <Monitor className="mr-2 h-4 w-4" />
                        {strings.systemMode}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <div className="flex flex-col gap-2 pt-2">
                {!isAuthenticated ? (
                  <>
                    <Button variant="outline" asChild className="w-full bg-transparent">
                      <Link href="/auth/login" onClick={() => setMobileMenuOpen(false)}>
                        {strings.nav_login}
                      </Link>
                    </Button>
                    <Button asChild className="w-full">
                      <Link href="/auth/sign-up" onClick={() => setMobileMenuOpen(false)}>
                        {strings.nav_get_started}
                      </Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-start bg-transparent">
                          <Avatar className="h-8 w-8 mr-2">
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {getUserInitials()}
                            </AvatarFallback>
                          </Avatar>
                          {profile?.email?.split("@")[0] || "User"}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>
                          <div className="flex flex-col space-y-1">
                            <p className="text-sm font-medium leading-none">
                              {profile?.email?.split("@")[0] || "User"}
                            </p>
                            <p className="text-xs leading-none text-muted-foreground">
                              {profile?.email || ""}
                            </p>
                          </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href="/overview" onClick={() => setMobileMenuOpen(false)}>
                            {strings.nav_dashboard}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/settings/account" onClick={() => setMobileMenuOpen(false)}>
                            {strings.nav_account_settings}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleLogout}>{strings.logout}</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}

'use client'

import { AppSidebar } from '@/components/common/app-sidebar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { usePreferencesStore } from '@/store/preferences-store'
import { strings } from '@/lib/strings'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { navItems } from '@/config/nav-config'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu'
import { Settings, Sun, Moon, Monitor } from 'lucide-react'

/**
 * Dashboard Layout
 * 
 * Wraps all dashboard pages with:
 * - Authentication protection
 * - Sidebar navigation
 * - Header with user menu
 * - Responsive structure
 * - RTL/LTR support
 */
export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const theme = usePreferencesStore((state) => state.theme)
    const setTheme = usePreferencesStore((state) => state.setTheme)
    const { isAuthenticated, hasHydrated } = useAuth()
    const router = useRouter()
    const pathname = usePathname()
    const [isMounted, setIsMounted] = useState(false)

    const getThemeIcon = () => {
        if (theme === 'light') return <Sun className="h-4 w-4" />
        if (theme === 'dark') return <Moon className="h-4 w-4" />
        return <Monitor className="h-4 w-4" />
    }

    const getNavTitle = useCallback((title: string): string => {
        const translations: Record<string, string> = {
            'Overview': strings.dashboard_overview,
            'Settings': strings.dashboard_settings,
            'Account': strings.nav_account_settings,
        }
        return translations[title] || title
    }, [])

    // Generate dynamic breadcrumbs based on current pathname
    const breadcrumbs = useMemo(() => {
        const generateBreadcrumbs = () => {
            const items: Array<{ title: string; href: string; isLast: boolean }> = []
            
            // If we're at root or marketplace, return just Marketplace
            if (pathname === '/' || pathname === '/overview') {
                items.push({
                    title: strings.dashboard_overview,
                    href: '/overview',
                    isLast: true,
                })
                return items
            }

            // Split pathname into segments and filter out empty strings
            const segments = pathname.split('/').filter(Boolean)
            
            // Track if we've added marketplace as the first breadcrumb
            let marketplaceAdded = false
            
            // Find matching nav items
            let currentPath = ''
            
            for (let i = 0; i < segments.length; i++) {
                currentPath += `/${segments[i]}`

                // Try to find a matching nav item
                let found = false
                
                // Check main nav items
                for (const navItem of navItems) {
                    if (navItem.href === currentPath) {
                        // Add marketplace as first breadcrumb if not already added and not on marketplace
                        if (!marketplaceAdded && navItem.href !== '/overview') {
                            items.push({
                                title: strings.dashboard_overview,
                                href: '/overview',
                                isLast: false,
                            })
                            marketplaceAdded = true
                        }
                        
                        items.push({
                            title: getNavTitle(navItem.title),
                            href: navItem.href,
                            isLast: i === segments.length - 1,
                        })
                        found = true
                        break
                    }
                    
                    // Check sub-items
                    if (navItem.items) {
                        for (const subItem of navItem.items) {
                            if (subItem.href === currentPath) {
                                // Add marketplace as first breadcrumb if not already added
                                if (!marketplaceAdded) {
                                    items.push({
                                        title: strings.dashboard_overview,
                                        href: '/overview',
                                        isLast: false,
                                    })
                                    marketplaceAdded = true
                                }
                                
                                // Add parent if not already added
                                const parentExists = items.some(item => item.href === navItem.href)
                                if (!parentExists) {
                                    items.push({
                                        title: getNavTitle(navItem.title),
                                        href: navItem.href,
                                        isLast: false,
                                    })
                                }
                                
                                items.push({
                                    title: getNavTitle(subItem.title),
                                    href: subItem.href,
                                    isLast: i === segments.length - 1,
                                })
                                found = true
                                break
                            }
                        }
                    }
                }
                
                // If no nav item found, create a breadcrumb from the segment
                if (!found) {
                    // Add marketplace as first breadcrumb if not already added
                    if (!marketplaceAdded) {
                        items.push({
                            title: strings.dashboard_overview,
                            href: '/overview',
                            isLast: false,
                        })
                        marketplaceAdded = true
                    }
                    
                    const segmentTranslations: Record<string, string> = {
                        'account': strings.nav_account_settings,
                    }
                    const title =
                        segmentTranslations[segments[i]] ||
                        segments[i].split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
                    
                    items.push({
                        title,
                        href: currentPath,
                        isLast: i === segments.length - 1,
                    })
                }
            }
            
            // Mark the last item
            if (items.length > 0) {
                items[items.length - 1].isLast = true
            }
            
            return items
        }
        
        return generateBreadcrumbs()
    }, [pathname, getNavTitle])

    useEffect(() => {
        // Mark component as mounted to ensure hydration is complete
        setIsMounted(true)
    }, [])

    useEffect(() => {
        // Only check auth after component is mounted (hydration complete)
        if (isMounted && hasHydrated && !isAuthenticated) {
            router.push('/auth/login')
        }
    }, [isMounted, hasHydrated, isAuthenticated, router])

    // Show loading state while checking authentication and hydrating
    if (!isMounted || !hasHydrated) {
        return (
            <div className="min-h-svh flex items-center justify-center">
                <div className="text-muted-foreground">
                    {strings.loading}
                </div>
            </div>
        )
    }

    // Don't render dashboard if not authenticated
    if (!isAuthenticated) {
        return (
            <div className="min-h-svh flex items-center justify-center">
                <div className="text-muted-foreground">
                    {strings.dashboard_redirect_login}
                </div>
            </div>
        )
    }

    const isDarkMode = theme === 'dark'

    const handleThemeToggle = (checked: boolean) => {
        setTheme(checked ? 'dark' : 'light')
    }

    return (
        <div className="min-h-svh">
            <SidebarProvider>
                <AppSidebar />
                <SidebarInset>
                    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-2 px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
                        <div className="flex flex-1 items-center gap-2">
                            <SidebarTrigger className="-ml-1" />
                            <Separator
                                orientation="vertical"
                                className="mr-2 data-[orientation=vertical]:h-4"
                            />
                            <Breadcrumb>
                                <BreadcrumbList>
                                    {breadcrumbs.map((crumb, index) => (
                                        <div key={crumb.href} className="flex items-center">
                                            {index > 0 && (
                                                <BreadcrumbSeparator className="hidden md:block" />
                                            )}
                                            <BreadcrumbItem className={index === 0 ? 'hidden md:block' : ''}>
                                                {crumb.isLast ? (
                                                    <BreadcrumbPage>{crumb.title}</BreadcrumbPage>
                                                ) : (
                                                    <BreadcrumbLink asChild>
                                                        <Link href={crumb.href}>{crumb.title}</Link>
                                                    </BreadcrumbLink>
                                                )}
                                            </BreadcrumbItem>
                                        </div>
                                    ))}
                                </BreadcrumbList>
                            </Breadcrumb>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                          <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Settings">
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Settings</DropdownMenuLabel>
                <DropdownMenuSeparator />

                {/* Theme Submenu */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    {getThemeIcon()}
                    <span className="ml-2">Theme</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
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
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>
                        </div>
                    </header>
                    <main className="flex flex-1 flex-col overflow-hidden">
                        {children}
                    </main>
                </SidebarInset>
            </SidebarProvider>
        </div>
    )
}

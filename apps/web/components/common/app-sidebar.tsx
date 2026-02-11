"use client"

import type * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, LayoutGrid } from "lucide-react"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { strings } from "@/lib/strings"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { LogOut, ChevronsUpDown } from "lucide-react"
import { useRouter } from "next/navigation"
import { navItems, userNavItems, type NavItem } from "@/config/nav-config"

/**
 * Enhanced AppSidebar Component with sidebar-8 pattern
 *
 * Improvements:
 * - Better visual hierarchy with enhanced spacing and typography
 * - Improved hover states and transitions
 * - Enhanced user profile section with status indicator
 * - Optimized active state indicators
 * - Better contrast and readability
 * - Smooth animations and interactions
 */
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { profile, signOut } = useAuth()
  const router = useRouter()
  const { state: sidebarState } = useSidebar()

  const handleLogout = () => {
    signOut()
    router.push("/auth/login")
  }

  const getUserInitials = () => {
    if (!profile?.email) return "U"
    return profile.email.charAt(0).toUpperCase()
  }

  return (
    <Sidebar collapsible="icon" side="left" variant="floating" {...props}>
      {/* Sidebar Header with Branding - Enhanced */}
      <SidebarHeader
        className={`border-b border-sidebar-border/50 bg-sidebar-accent/30 px-0 ${
          sidebarState === "collapsed" ? "flex justify-center" : ""
        }`}
      >
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              className={`data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground hover:bg-sidebar-accent/50 transition-colors duration-200 ${
                sidebarState === "collapsed" ? "justify-center px-2" : "px-4"
              }`}
            >
              <Link
                href="/"
                className={`flex items-center gap-3 ${sidebarState === "collapsed" ? "justify-center w-full" : ""}`}
                title={sidebarState === "collapsed" ? strings.app_name : undefined}
              >
                <div
                  className={`flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ${
                    sidebarState === "collapsed" ? "h-10 w-10" : "h-10 w-10"
                  }`}
                >
                  <LayoutGrid className="h-5 w-5" />
                </div>
                {sidebarState !== "collapsed" && (
                  <div className="grid flex-1 min-w-0 text-left text-sm leading-tight">
                    <span className="truncate font-semibold text-sidebar-foreground">{strings.app_name}</span>
                    <span className="truncate text-xs text-sidebar-foreground/60">
                      {strings.dashboard_overview}
                    </span>
                  </div>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Main Navigation Content - Enhanced */}
      <SidebarContent className="px-0">
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wider">
            {strings.dashboard_navigation}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <NavItemComponent key={item.href} item={item} pathname={pathname} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* User Settings Section - Enhanced */}
        {userNavItems.length > 0 && (
          <>
            <SidebarSeparator className="my-3 bg-sidebar-border/30" />
            <SidebarGroup>
              <SidebarGroupLabel className="px-4 text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wider">
                {strings.dashboard_settings}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {userNavItems.map((item) => (
                    <NavItemComponent key={item.href} item={item} pathname={pathname} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      {/* User Profile Footer - Enhanced */}
      <SidebarFooter
        className={`border-t border-sidebar-border/50 bg-sidebar-accent/20 px-0 ${
          sidebarState === "collapsed" ? "flex justify-center" : ""
        }`}
      >
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuButton
                        size="lg"
                        className={`data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground w-full hover:bg-sidebar-accent/40 transition-colors duration-200 ${
                          sidebarState === "collapsed" ? "justify-center px-2" : "px-4"
                        }`}
                        tooltip={sidebarState === "collapsed" ? profile?.email?.split("@")[0] || "User" : undefined}
                      >
                        <div className="relative shrink-0">
                          <Avatar className="h-8 w-8 rounded-lg border border-sidebar-accent/50">
                            <AvatarFallback className="rounded-lg from-primary/20 to-primary/10 text-primary font-semibold">
                              {getUserInitials()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="absolute -bottom-0.5 -right-0.5 size-2.5 bg-green-500 rounded-full border border-sidebar shadow-sm"></span>
                        </div>
                        {sidebarState !== "collapsed" && (
                          <>
                            <div
                              className="grid flex-1 text-left text-sm leading-tight min-w-0"
                            >
                              <span className="truncate font-semibold text-sidebar-foreground">
                                {profile?.email?.split("@")[0] || "User"}
                              </span>
                              <span className="truncate text-xs text-sidebar-foreground/60">
                                {profile?.email || ""}
                              </span>
                            </div>
                            <ChevronsUpDown
                              className="ml-auto size-4 shrink-0 text-sidebar-foreground/60"
                            />
                          </>
                        )}
                      </SidebarMenuButton>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  {sidebarState === "collapsed" && (
                    <TooltipContent side="right" className="flex items-center gap-2">
                      <div className="text-sm">
                        <div className="font-semibold">{profile?.email?.split("@")[0] || "User"}</div>
                        <div className="text-xs text-muted-foreground">{profile?.email || ""}</div>
                      </div>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
              <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg border border-sidebar-border/30 bg-sidebar-accent shadow-lg"
                side="right"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-2 py-2 text-left">
                    <Avatar className="h-8 w-8 rounded-lg shrink-0 border border-sidebar-accent">
                      <AvatarFallback className="rounded-lg from-primary/20 to-primary/10 text-primary font-semibold">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className="grid flex-1 text-left text-sm leading-tight min-w-0"
                    >
                      <span className="truncate font-semibold text-sidebar-foreground">
                        {profile?.email?.split("@")[0] || "User"}
                      </span>
                      <span className="truncate text-xs text-sidebar-foreground/60">{profile?.email || ""}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-sidebar-border/30" />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer hover:bg-sidebar-accent/60 transition-colors"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {strings.dashboard_log_out}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

/**
 * Enhanced Navigation Item Component
 * Handles both simple links and collapsible sub-menus with improved styling
 */
function NavItemComponent({
  item,
  pathname,
}: {
  item: NavItem
  pathname: string
}) {
  const { state: sidebarState } = useSidebar()
  const isCollapsed = sidebarState === "collapsed"
  const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
  const hasSubItems = item.items && item.items.length > 0

  const getNavTitle = (key: string): string => {
    const translations: Record<string, string> = {
      Overview: strings.dashboard_overview,
      Settings: strings.dashboard_settings,
      Account: strings.nav_account_settings,
    }
    return translations[key] || key
  }

  const title = getNavTitle(item.title)

  if (hasSubItems) {
    const isSubItemActive = item.items?.some(
      (subItem) => pathname === subItem.href || pathname.startsWith(subItem.href + "/"),
    )

    return (
      <Collapsible key={item.title} asChild defaultOpen={isActive || isSubItemActive} className="group/collapsible">
        <SidebarMenuItem>
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    tooltip={isCollapsed ? title : undefined}
                    isActive={isActive || isSubItemActive}
                    className={`w-full transition-all duration-200 ${isActive || isSubItemActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50"}`}
                  >
                    {item.icon && <item.icon className="shrink-0" />}
                    <span className="truncate">{title}</span>
                    {item.badge && !isCollapsed && (
                      <Badge
                        variant="secondary"
                        className="ml-auto shrink-0 bg-primary/20 text-primary"
                      >
                        {item.badge}
                      </Badge>
                    )}
                    <ChevronDown
                      className="ml-auto shrink-0 transition-transform duration-300 group-data-[state=open]/collapsible:rotate-180"
                    />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right" className="flex items-center gap-2">
                  {title}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          <CollapsibleContent>
            <SidebarMenuSub>
              {item.items?.map((subItem) => {
                const isSubActive = pathname === subItem.href || pathname.startsWith(subItem.href + "/")
                const subTitle = getNavTitle(subItem.title)
                return (
                  <SidebarMenuSubItem key={subItem.title}>
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarMenuSubButton
                            asChild
                            isActive={isSubActive}
                            className={`transition-all duration-200 ${isSubActive ? "bg-sidebar-accent/60" : "hover:bg-sidebar-accent/30"}`}
                          >
                            <Link href={subItem.href} className="flex items-center gap-2">
                              <span className="truncate">{subTitle}</span>
                              {subItem.badge && !isCollapsed && (
                                <Badge
                                  variant="secondary"
                                  className="ml-auto shrink-0 bg-primary/20 text-primary text-xs"
                                >
                                  {subItem.badge}
                                </Badge>
                              )}
                            </Link>
                          </SidebarMenuSubButton>
                        </TooltipTrigger>
                        {isCollapsed && (
                          <TooltipContent side="right">{subTitle}</TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </SidebarMenuSubItem>
                )
              })}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    )
  }

  return (
    <SidebarMenuItem>
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarMenuButton
              asChild
              tooltip={isCollapsed ? title : undefined}
              isActive={isActive}
              className={`transition-all duration-200 ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50"}`}
            >
              <Link href={item.href} className="flex items-center gap-2">
                {item.icon && <item.icon className="shrink-0" />}
                <span className="truncate">{title}</span>
                {item.badge && !isCollapsed && (
                  <Badge
                    variant="secondary"
                    className="ml-auto shrink-0 bg-primary/20 text-primary"
                  >
                    {item.badge}
                  </Badge>
                )}
              </Link>
            </SidebarMenuButton>
          </TooltipTrigger>
          {isCollapsed && <TooltipContent side="right">{title}</TooltipContent>}
        </Tooltip>
      </TooltipProvider>
    </SidebarMenuItem>
  )
}

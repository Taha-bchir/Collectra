import { LayoutDashboard, Settings, type LucideIcon } from 'lucide-react'

export interface NavItem {
  title: string
  href: string
  icon: LucideIcon
  badge?: string
  items?: NavSubItem[]
}

export interface NavSubItem {
  title: string
  href: string
  badge?: string
}

export const navItems: NavItem[] = [
  {
    title: 'Overview',
    href: '/overview',
    icon: LayoutDashboard,
  },
]

export const userNavItems: NavItem[] = [
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
    items: [
      {
        title: 'Account',
        href: '/settings/account',
      },
    ],
  },
]

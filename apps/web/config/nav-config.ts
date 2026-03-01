import { LayoutDashboard, Settings, Users, UserPlus, type LucideIcon } from 'lucide-react'

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
  {
    title: 'Team',
    href: '/team',
    icon: Users,
  },
  {
    title: 'Accept Invite',
    href: '/auth/accept-invite',
    icon: UserPlus,
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

'use client'

import { useAuth } from '@/features/auth/hooks/use-auth'
import { strings } from '@/lib/strings'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, Users, Shield, Zap } from 'lucide-react'

const DUMMY_STATS = [
  { label: 'Total users', value: '—', icon: Users, description: 'Placeholder metric' },
  { label: 'Active sessions', value: '1', icon: Activity, description: 'Current session' },
  { label: 'Auth checks', value: 'OK', icon: Shield, description: 'Authorization enabled' },
  { label: 'API status', value: 'Ready', icon: Zap, description: 'Hono API' },
]

export default function OverviewPage() {
  const { profile } = useAuth()

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8 overflow-auto">
      <div>
        <h1 className="text-3xl font-bold">{strings.dashboard_overview}</h1>
        <p className="text-muted-foreground mt-1">
          {strings.dashboard_overview_description}
        </p>
      </div>

      {profile && (
        <p className="text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{profile.email}</span>
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {DUMMY_STATS.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label} className="border border-border/60">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <CardDescription className="text-xs">{stat.description}</CardDescription>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="border border-border/60">
        <CardHeader>
          <CardTitle>Dashboard placeholder</CardTitle>
          <CardDescription>
            Replace this overview with your own metrics and data. The boilerplate provides
            authentication, authorization, and user management; add your domain features here.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}

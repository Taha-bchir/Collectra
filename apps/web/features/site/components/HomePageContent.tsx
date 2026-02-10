"use client"

import Link from "next/link"
import { ArrowRight, KeyRound, Shield, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { strings } from "@/lib/strings"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export function HomePageContent() {
  const { isAuthenticated, hasHydrated } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (hasHydrated && isAuthenticated) {
      router.replace("/overview")
    }
  }, [hasHydrated, isAuthenticated, router])

  const features = [
    {
      icon: KeyRound,
      title: strings.landing_feature_auth_title,
      description: strings.landing_feature_auth_desc,
    },
    {
      icon: Shield,
      title: strings.landing_feature_authz_title,
      description: strings.landing_feature_authz_desc,
    },
    {
      icon: User,
      title: strings.landing_feature_user_title,
      description: strings.landing_feature_user_desc,
    },
  ]

  if (hasHydrated && isAuthenticated) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-muted-foreground">Redirecting to dashboard…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10" />
        <div className="container mx-auto px-4 lg:px-8 max-w-7xl relative">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-5 py-2.5 rounded-full text-sm font-medium border border-primary/20">
              <span>{strings.landing_badge}</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-balance leading-tight tracking-tight">
              {strings.landing_title_main}{" "}
              <span className="bg-gradient-to-br from-primary to-primary/70 bg-clip-text text-transparent">
                {strings.landing_title_highlight}
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
              {strings.landing_description}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button size="lg" className="gap-2 px-8 h-12 font-semibold" asChild>
                <Link href="/auth/login">
                  {strings.nav_login}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="gap-2 px-8 h-12 font-semibold" asChild>
                <Link href="/auth/sign-up">{strings.nav_get_started}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-24">
        <div className="container mx-auto px-4 lg:px-8 max-w-7xl">
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((feature) => {
              const Icon = feature.icon
              return (
                <Card
                  key={feature.title}
                  className="border border-border/60 hover:border-primary/30 transition-colors bg-card/50"
                >
                  <CardHeader className="space-y-2">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary/10">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="leading-relaxed">{feature.description}</CardDescription>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-24 bg-muted/20">
        <div className="container mx-auto px-4 lg:px-8 max-w-7xl">
          <Card className="border-2 border-primary/20 shadow-lg bg-card/80 max-w-3xl mx-auto">
            <CardHeader className="text-center space-y-2 py-8">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mx-auto">
                {strings.landing_cta_badge}
              </div>
              <CardTitle className="text-2xl md:text-3xl">{strings.landing_cta_title}</CardTitle>
              <CardDescription className="text-base">
                {strings.landing_cta_description}
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-8 flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="gap-2 font-semibold" asChild>
                <Link href="/auth/sign-up">
                  {strings.landing_cta_primary_call}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="gap-2 font-semibold" asChild>
                <Link href="/auth/login">{strings.nav_login}</Link>
              </Button>
            </CardContent>
            <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground pb-6">
              <span className="flex items-center gap-1.5">{strings.landing_cta_benefit_free}</span>
              <span className="flex items-center gap-1.5">{strings.landing_cta_benefit_no_card}</span>
              <span className="flex items-center gap-1.5">{strings.landing_cta_benefit_cancel}</span>
            </div>
          </Card>
        </div>
      </section>
    </div>
  )
}

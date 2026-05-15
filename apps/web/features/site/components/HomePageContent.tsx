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

  if (hasHydrated && isAuthenticated) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-muted-foreground">Redirecting to dashboard…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-background via-background to-muted/20">
      <section className="relative py-16 lg:py-24">
        <div className="container mx-auto px-4 lg:px-8 max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2.5 rounded-full text-sm font-medium border border-primary/20 mb-6">
                <span>{strings.landing_badge}</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight">
                {strings.landing_title_main} <span className="bg-linear-to-br from-primary to-primary/70 bg-clip-text text-transparent">{strings.landing_title_highlight}</span>
              </h1>
              <p className="mt-4 text-lg text-muted-foreground max-w-2xl">{strings.landing_description}</p>

              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="gap-2 px-8 h-12 font-semibold" asChild>
                  <Link href="/auth/sign-up">
                    {strings.landing_cta_primary_call} <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="gap-2 px-8 h-12 font-semibold" asChild>
                  <Link href="/auth/login">{strings.nav_login}</Link>
                </Button>
              </div>

              <div className="mt-8 flex flex-wrap gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2"><strong className="text-foreground">{"100+"}</strong><span>customers</span></div>
                <div className="flex items-center gap-2"><strong className="text-foreground">{"99.9%"}</strong><span>uptime</span></div>
                <div className="flex items-center gap-2"><strong className="text-foreground">{"<1h"}</strong><span>integration</span></div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="w-full rounded-xl bg-linear-to-br from-primary/10 to-primary/5 border border-border/60 p-8">
                <div className="h-48 sm:h-56 w-full rounded-lg border border-border/60 bg-background/80 p-4 shadow-sm">
                  <svg
                    viewBox="0 0 640 360"
                    role="img"
                    aria-label="Dashboard illustration showing a payment workflow"
                    className="h-full w-full"
                  >
                    <defs>
                      <linearGradient id="hero-card" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#FFF7B0" stopOpacity="0.9" />
                        <stop offset="100%" stopColor="#FFF0A0" stopOpacity="0.45" />
                      </linearGradient>
                      <linearGradient id="hero-line" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#F5D94A" />
                        <stop offset="100%" stopColor="#9BE7C4" />
                      </linearGradient>
                    </defs>

                    <rect x="8" y="8" width="624" height="344" rx="28" fill="url(#hero-card)" />
                    <rect x="36" y="36" width="568" height="52" rx="16" fill="#FFFDF2" opacity="0.98" />
                    <circle cx="70" cy="62" r="10" fill="#E8D64D" />
                    <rect x="96" y="50" width="138" height="10" rx="5" fill="#1E1E1E" opacity="0.78" />
                    <rect x="96" y="68" width="92" height="8" rx="4" fill="#4D4D4D" opacity="0.55" />

                    <rect x="36" y="108" width="210" height="200" rx="24" fill="#FFFDF6" opacity="0.98" />
                    <rect x="266" y="108" width="338" height="200" rx="24" fill="#FFFDF6" opacity="0.98" />

                    <rect x="60" y="136" width="92" height="12" rx="6" fill="#6B7280" opacity="0.55" />
                    <rect x="60" y="162" width="126" height="22" rx="11" fill="#E8D64D" opacity="0.55" />
                    <rect x="60" y="198" width="164" height="14" rx="7" fill="#6B7280" opacity="0.4" />
                    <rect x="60" y="224" width="146" height="14" rx="7" fill="#6B7280" opacity="0.3" />
                    <rect x="60" y="250" width="106" height="14" rx="7" fill="#6B7280" opacity="0.22" />

                    <path
                      d="M292 264C328 230 355 232 388 212C422 192 441 154 494 160C530 164 548 184 566 146"
                      fill="none"
                      stroke="url(#hero-line)"
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx="292" cy="264" r="9" fill="#E8D64D" />
                    <circle cx="388" cy="212" r="9" fill="#E8D64D" />
                    <circle cx="494" cy="160" r="9" fill="#9BE7C4" />
                    <circle cx="566" cy="146" r="9" fill="#9BE7C4" />

                    <rect x="292" y="188" width="126" height="36" rx="18" fill="#E8D64D" opacity="0.22" />
                    <rect x="292" y="190" width="78" height="10" rx="5" fill="#1E1E1E" opacity="0.78" />
                    <rect x="292" y="208" width="108" height="8" rx="4" fill="#5C5C5C" opacity="0.58" />

                    <rect x="458" y="190" width="124" height="54" rx="18" fill="#FFFFFF" opacity="0.95" stroke="#E4E4E7" />
                    <rect x="478" y="206" width="84" height="10" rx="5" fill="#6B7280" opacity="0.45" />
                    <rect x="478" y="224" width="62" height="10" rx="5" fill="#E8D64D" opacity="0.95" />
                  </svg>
                </div>
                <div className="mt-4 text-sm text-muted-foreground">Collectra integrates with your accounting and emailing workflows to send friendly payment links and track outcomes automatically.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 lg:py-16">
        <div className="container mx-auto px-4 lg:px-8 max-w-7xl">
          <h2 className="text-2xl font-semibold mb-6">How it works</h2>
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="border-border/60">
              <CardHeader className="space-y-2">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary/10">
                  <KeyRound className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Connect your data</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="leading-relaxed">Import invoices or sync your accounting software to pull outstanding debts into Collectra.</CardDescription>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader className="space-y-2">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary/10">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Automate reminders</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="leading-relaxed">Configure friendly reminder schedules and let Collectra send payment links on your behalf.</CardDescription>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader className="space-y-2">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary/10">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Track & recover</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="leading-relaxed">Monitor payment link clicks, partial payments, and collect with multiple payment methods.</CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-12 lg:py-16">
        <div className="container mx-auto px-4 lg:px-8 max-w-7xl">
          <h2 className="text-2xl font-semibold mb-6">Frequently asked questions</h2>
          <div className="space-y-4">
            <details className="group rounded-lg border border-border/60 p-4">
              <summary className="cursor-pointer font-medium">How quickly can we start using the product?</summary>
              <div className="mt-2 text-sm text-muted-foreground">You can sign up and explore the dashboard immediately. Typical production integrations vary based on systems and volume.</div>
            </details>

            <details className="group rounded-lg border border-border/60 p-4">
              <summary className="cursor-pointer font-medium">Can the platform be customized to our needs?</summary>
              <div className="mt-2 text-sm text-muted-foreground">Yes. Settings, templates, and workflows are configurable to match your processes and branding.</div>
            </details>

            <details className="group rounded-lg border border-border/60 p-4">
              <summary className="cursor-pointer font-medium">How is customer and account data protected?</summary>
              <div className="mt-2 text-sm text-muted-foreground">We follow standard security practices, use encrypted connections, and limit access to authorized personnel. For specifics, contact privacy@collectra.xyz.</div>
            </details>
          </div>
        </div>
      </section>

      <section className="py-12 lg:py-16">
        <div className="container mx-auto px-4 lg:px-8 max-w-7xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="p-6 bg-card/60 rounded-lg text-center border border-border/60">
              <div className="text-2xl font-bold">{"100+"}</div>
              <div className="text-sm text-muted-foreground">Trusted customers</div>
            </div>
            <div className="p-6 bg-card/60 rounded-lg text-center border border-border/60">
              <div className="text-2xl font-bold">{"99.9%"}</div>
              <div className="text-sm text-muted-foreground">Uptime SLA</div>
            </div>
            <div className="p-6 bg-card/60 rounded-lg text-center border border-border/60">
              <div className="text-2xl font-bold">{"< 1h"}</div>
              <div className="text-sm text-muted-foreground">Avg integration time</div>
            </div>
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
              <CardDescription className="text-base">{strings.landing_cta_description}</CardDescription>
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

            <div className="border-t border-border/50 pt-6 pb-8 px-6">
              <blockquote className="max-w-2xl mx-auto text-center">
                <p className="text-lg italic text-foreground/90">“Collectra made onboarding and payments effortless — setup was minutes, support excellent.”</p>
                <cite className="block mt-3 text-sm text-muted-foreground">— Alex Martin, Founder at Acme Co.</cite>
              </blockquote>
            </div>
          </Card>
        </div>
      </section>
    </div>
  )
}

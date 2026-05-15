import { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Privacy Policy - Collectra',
  description: 'Privacy policy for Collectra — how we handle data, cookies and security.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-4 lg:px-8 max-w-4xl">
        <nav className="text-sm mb-6">
          <Link href="/" className="text-primary hover:underline">Home</Link>
          <span className="mx-2 text-muted-foreground">/</span>
          <span className="text-muted-foreground">Privacy Policy</span>
        </nav>

        <header className="mb-8">
          <h1 className="text-3xl font-bold">Privacy Policy</h1>
          <p className="text-muted-foreground mt-2">Last updated: May 15, 2026</p>
        </header>

        <main className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <p>
                Collectra helps businesses recover outstanding payments with transparent
                customer communication and secure payment links. This policy explains what data
                we collect, how we use it, and the choices you have.
              </p>
            </CardContent>
          </Card>

          <section className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Information We Collect</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
                  <li>Account data: name, email, company workspace details.</li>
                  <li>Customer & transactional data: debts, invoices, payment attempts, statuses.</li>
                  <li>Communication data: emails and support messages.</li>
                  <li>Usage & analytics: logs, performance metrics, and aggregated usage data.</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>How We Use Your Data</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  We use data to operate the service, process payments, send collection emails,
                  provide support, and improve product features. We do not sell personal data.
                </p>
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Cookies & Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                We use cookies for authentication (HTTP-only), session management, and analytics.
                Authentication cookies are required to access your workspace and are not readable
                by JavaScript. Below is a summary of cookies used by Collectra.
              </p>

              <div className="overflow-x-auto mt-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="pb-2">Name</th>
                      <th className="pb-2">Purpose</th>
                      <th className="pb-2">Retention</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-2">access_token</td>
                      <td className="py-2">HTTP-only auth token for API requests</td>
                      <td className="py-2">Short-lived (session)</td>
                    </tr>
                    <tr className="bg-muted/10">
                      <td className="py-2">refresh_token</td>
                      <td className="py-2">Long-lived token to refresh sessions</td>
                      <td className="py-2">30 days</td>
                    </tr>
                    <tr>
                      <td className="py-2">_collectra_session</td>
                      <td className="py-2">UI preferences and non-sensitive flags</td>
                      <td className="py-2">1 year</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Retention & Deletion</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                We retain account and transactional data as required to provide the service and to
                meet legal obligations. You can request deletion of your account and associated
                data by contacting us; some data necessary for accounting or legal reasons may be
                retained as required by law.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Third-Party Services</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                We use third-party providers for hosting, email delivery, analytics, and payment
                processing (for example, Supabase, Stripe, Brevo). These providers have their own
                privacy practices — we ensure contracts require appropriate data protection.
              </p>
            </CardContent>
          </Card>

          <section>
            <Card>
              <CardHeader>
                <CardTitle>Your Rights</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
                  <li>Access and portability of your personal information.</li>
                  <li>Correction of inaccurate information.</li>
                  <li>Request deletion of your account (subject to legal retention requirements).</li>
                </ul>
                <p className="mt-3 text-sm text-muted-foreground">
                  To exercise your rights, email <a href="mailto:privacy@collectra.xyz">privacy@collectra.xyz</a>.
                </p>
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                We use administrative, technical, and physical safeguards to protect data. We
                regularly review our practices and maintain access controls for production systems.
              </p>
            </CardContent>
          </Card>

          <footer className="text-sm text-muted-foreground">
            <p>
              For questions about this policy or to make a privacy request, contact us at{' '}
              <a className="text-primary hover:underline" href="mailto:privacy@collectra.xyz">privacy@collectra.xyz</a>.
            </p>
          </footer>
        </main>
      </div>
    </div>
  )
}

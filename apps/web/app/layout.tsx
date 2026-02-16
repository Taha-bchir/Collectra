import type { Metadata } from 'next'
import {
  Geist,
  Geist_Mono,
  Source_Serif_4,
} from 'next/font/google'

import './globals.css'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from "@/components/common/theme-provider"

const geist = Geist({
  subsets: ['latin'],
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-geist',
})
const geistMono = Geist_Mono({
  subsets: ['latin'],
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-geist-mono',
})
const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-source-serif',
})

export const metadata: Metadata = {
  title: 'SaaS Boilerplate',
  description: 'Next.js + Hono monorepo with authentication, authorization, and user management',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'SaaS Boilerplate',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/placeholder.svg', type: 'image/svg+xml' },
      {
        url: '/placeholder.svg',
        media: '(prefers-color-scheme: light)',
        type: 'image/svg+xml',
      },
      {
        url: '/placeholder.svg',
        media: '(prefers-color-scheme: dark)',
        type: 'image/svg+xml',
      },
    ],
    apple: [{ url: '/placeholder.svg', type: 'image/svg+xml' }],
    shortcut: '/placeholder.svg',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geist.variable} ${geistMono.variable} ${sourceSerif.variable} font-sans antialiased`}
      >
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}

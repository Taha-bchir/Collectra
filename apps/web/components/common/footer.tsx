"use client"

import Link from "next/link"
import { strings } from "@/lib/strings"

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-4 lg:px-8 py-6">
        <div className="flex flex-col items-center gap-4">
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
            <span>© {new Date().getFullYear()} {strings.app_name}.</span>
            <span>•</span>
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              {strings.footer_privacy_policy}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

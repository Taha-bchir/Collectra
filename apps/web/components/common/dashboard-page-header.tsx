'use client'

import { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { strings, type StringKey } from '@/lib/strings'

interface DashboardPageHeaderProps {
  titleKey: StringKey
  descriptionKey?: StringKey
  /**
   * Optional back link. If provided, a small ghost button with ArrowLeft is rendered.
   */
  backHref?: string
  backLabelKey?: StringKey
  /**
   * Right-aligned actions (e.g., primary button, filters, etc.).
   */
  actions?: ReactNode
}

export function DashboardPageHeader({
  titleKey,
  descriptionKey,
  backHref,
  backLabelKey,
  actions,
}: DashboardPageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-2">
        {backHref && backLabelKey && (
          <Button asChild variant="ghost" size="sm" className="mb-1">
            <Link href={backHref}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {strings[backLabelKey]}
            </Link>
          </Button>
        )}
        <div>
          <h1 className="text-3xl font-bold">{strings[titleKey]}</h1>
          {descriptionKey && (
            <p className="text-muted-foreground mt-1">
              {strings[descriptionKey]}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}



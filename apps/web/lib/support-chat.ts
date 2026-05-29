import { strings } from '@/lib/strings'

export type SupportAction = {
  label: string
  href: string
}

export type SupportReply = {
  text: string
  actions: SupportAction[]
}

export const supportQuickQuestions = [
  strings.support_question_csv,
  strings.support_question_payments,
  strings.support_question_invoice,
  strings.support_question_account,
  strings.support_question_overview,
]

function normalize(message: string): string {
  return message.toLowerCase().trim()
}

export function getSupportActions(message: string): SupportAction[] {
  const normalized = normalize(message)

  if (/csv|import|spreadsheet|upload/.test(normalized)) {
    return [{ label: strings.support_link_campaigns, href: '/campaigns' }]
  }

  if (/payment link|payment links|pay link|send payment|recover|stripe invoice|invoice/.test(normalized)) {
    return [{ label: strings.support_link_payments, href: '/campaigns' }]
  }

  if (/account|settings|password|profile|email/.test(normalized)) {
    return [{ label: strings.support_link_account, href: '/settings/account' }]
  }

  if (/overview|dashboard|stats|metric|summary/.test(normalized)) {
    return [{ label: strings.support_link_overview, href: '/overview' }]
  }

  if (/campaign|table|campaigns/.test(normalized)) {
    return [{ label: strings.support_link_campaigns, href: '/campaigns' }]
  }

  return []
}

export function getLocalSupportReply(message: string): SupportReply {
  const normalized = normalize(message)
  const actions = getSupportActions(message)

  if (/csv|import|spreadsheet|upload/.test(normalized)) {
    return {
      text: strings.support_answer_csv,
      actions,
    }
  }

  if (/payment link|payment links|pay link|send payment|recover/.test(normalized)) {
    return {
      text: strings.support_answer_payments,
      actions,
    }
  }

  if (/stripe invoice|invoice|hosted invoice/.test(normalized)) {
    return {
      text: strings.support_answer_invoice,
      actions,
    }
  }

  if (/account|settings|password|profile|email/.test(normalized)) {
    return {
      text: strings.support_answer_account,
      actions,
    }
  }

  if (/overview|dashboard|stats|metric|summary/.test(normalized)) {
    return {
      text: strings.support_answer_overview,
      actions,
    }
  }

  if (/campaign|table|campaigns/.test(normalized)) {
    return {
      text: strings.support_answer_campaigns,
      actions,
    }
  }

  return {
    text: strings.support_fallback,
    actions,
  }
}
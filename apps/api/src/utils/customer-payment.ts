import type { DebtStatus } from '@repo/database'
import { HTTPException } from 'hono/http-exception'
import { utcCalendarDayStart } from './calendar.js'

type DebtPaymentState = {
  status: DebtStatus
  promiseDate: Date | null
}

export function isBeforePromiseDate(promiseDate: Date, reference = new Date()) {
  const todayStart = utcCalendarDayStart(reference)
  const promiseDateStart = utcCalendarDayStart(promiseDate)
  return todayStart.getTime() < promiseDateStart.getTime()
}

export function getOverdueReferenceDate(debt: {
  status: DebtStatus
  dueDate: Date
  promiseDate: Date | null
}) {
  if (debt.status === 'PROMISE_TO_PAY' && debt.promiseDate) {
    return utcCalendarDayStart(debt.promiseDate)
  }

  return utcCalendarDayStart(debt.dueDate)
}

export function isDebtOverdue(debt: {
  status: DebtStatus
  dueDate: Date
  promiseDate: Date | null
}, reference = new Date()) {
  if (debt.status === 'PAID' || debt.status === 'OVERDUE_AFTER_PROMISE') {
    return debt.status === 'OVERDUE_AFTER_PROMISE'
  }

  const todayStart = utcCalendarDayStart(reference)
  return todayStart.getTime() > getOverdueReferenceDate(debt).getTime()
}

export function assertCustomerPaymentAllowed(debt: DebtPaymentState) {
  if (debt.status === 'PAID') {
    throw new HTTPException(400, {
      message: 'This debt has already been paid',
    })
  }

  if (debt.status === 'OVERDUE_AFTER_PROMISE') {
    throw new HTTPException(400, {
      message: 'This debt is overdue and can no longer be paid online',
    })
  }

  if (debt.status === 'PROMISE_TO_PAY' && debt.promiseDate && isBeforePromiseDate(debt.promiseDate)) {
    const promiseDateLabel = debt.promiseDate.toISOString().split('T')[0]
    throw new HTTPException(400, {
      message: `Payment is not available until ${promiseDateLabel}`,
    })
  }
}

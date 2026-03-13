import { SignJWT, jwtVerify } from 'jose'
import { env } from '../config/env.js'

const EXPIRY_DAYS = 30
const AUDIENCE = 'collectra-customer'
const ISSUER = 'collectra-api'

function getSecret(): Uint8Array {
  const secret = env.JWT_SECRET
  if (!secret) {
    throw new Error(
      'JWT_SECRET is not set. Add JWT_SECRET to your .env file to use customer token links.',
    )
  }
  return new TextEncoder().encode(secret)
}

/**
 * Signs a short-lived JWT for a customer debt link.
 * The token encodes the debtId in the `sub` claim — no DB storage needed.
 */
export async function signCustomerToken(
  debtId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000)

  const token = await new SignJWT({ sub: debtId })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience(AUDIENCE)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getSecret())

  return { token, expiresAt }
}

/**
 * Verifies the customer JWT and returns the embedded debtId and expiry.
 * Throws if the token is invalid, tampered with, or expired.
 */
export async function verifyCustomerToken(
  token: string,
): Promise<{ debtId: string; expiresAt: Date }> {
  const { payload } = await jwtVerify(token, getSecret(), {
    audience: AUDIENCE,
    issuer: ISSUER,
  })

  if (!payload.sub) {
    throw new Error('Invalid customer token: missing subject')
  }

  return {
    debtId: payload.sub,
    expiresAt: new Date((payload.exp ?? 0) * 1000),
  }
}

# Brevo + Supabase Setup Guide (Domain + Confirmation Email)

This guide explains how to:

1. Connect your bought domain to Brevo for reliable email sending.
2. Link your domain with Supabase/Auth URLs.
3. Ensure every new account in Collectra receives a confirmation email.

This is tailored to the current Collectra monorepo and existing auth flow.

## 1. What already exists in this project

Your project already supports email confirmation flow:

- Backend register endpoint: `POST /api/v1/authentication/register`
- Supabase signup call includes `emailRedirectTo`.
- Web app includes `/auth/sign-up`, `/auth/sign-up-success`, and `/auth/verify` pages.

So you mostly need provider/domain configuration (Brevo + Supabase dashboard + env values).

## 2. Prerequisites

Before starting, make sure you have:

- A verified domain you bought (example: `collectra.com`).
- A Brevo account.
- A Supabase project.
- DNS access at your domain registrar (Cloudflare, Namecheap, GoDaddy, etc.).

## 3. Configure Brevo for your domain

1. In Brevo, go to **Senders, Domains & Dedicated IPs**.
2. Add your sending domain (example: `mail.collectra.com` or `collectra.com`).
3. Add the DNS records Brevo gives you (typically SPF/DKIM records).
4. Wait for DNS propagation, then click **Verify** in Brevo.
5. Create a sender address, for example `no-reply@collectra.com`.
6. Generate an SMTP key in Brevo.

Recommended DNS records for deliverability:

- SPF TXT record including Brevo.
- DKIM records from Brevo.
- DMARC TXT record (recommended for anti-spoofing).

## 4. Configure Supabase to send emails through Brevo

1. Open Supabase Dashboard.
2. Go to **Authentication > Email > SMTP Settings**.
3. Enable custom SMTP.
4. Fill with Brevo SMTP values:
   - Host: `smtp-relay.brevo.com`
   - Port: `587` (TLS)
   - Username: your Brevo SMTP login
   - Password: your Brevo SMTP key
   - Sender email: `no-reply@your-domain.com`
   - Sender name: `Collectra`
5. Save and send a test email from Supabase.

## 5. Link your domain in Supabase Auth

In Supabase, go to **Authentication > URL Configuration** and set:

1. **Site URL**
   - Production: `https://collectra.xyz`
2. **Redirect URLs** (add each URL explicitly)
   - `https://collectra.xyz/auth/verify`
   - `https://collectra.xyz/auth/reset-password`
   - `https://collectra.xyz/auth/callback`
   - Local dev URLs if needed:
     - `http://localhost:3001/auth/verify`
     - `http://localhost:3001/auth/reset-password`
     - `http://localhost:3001/auth/callback`

Also ensure **Email confirmations** are enabled in Supabase Auth.

## 6. Optional: Supabase custom domain (project URL branding)

If you want Supabase-hosted links/services to use your branded domain:

1. Open Supabase project settings and find **Custom Domains**.
2. Add your desired domain/subdomain.
3. Add required DNS records (usually CNAME/TXT) at your registrar.
4. Wait for verification and SSL provisioning.

Note: this may require a paid Supabase plan depending on current Supabase limits.

## 7. Set Collectra environment variables

Update your root environment file (`.env.production` or `.env.development`) with URLs that match your domain:

```env
# API app (apps/api)
WEB_URL=https://collectra.xyz
ALLOWED_ORIGINS=https://collectra.xyz

SUPABASE_EMAIL_REDIRECT_URL=https://collectra.xyz/auth/verify
SUPABASE_RESET_REDIRECT_URL=https://collectra.xyz/auth/reset-password
SUPABASE_OAUTH_REDIRECT_URL=https://collectra.xyz/auth/callback
```

And in `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=https://api.your-domain.com
NEXT_PUBLIC_APP_AUTH_STORAGE_KEY=collectra.auth
NEXT_PUBLIC_APP_PREFERENCES_STORAGE_KEY=collectra.preferences
NEXT_PUBLIC_DEFAULT_THEME=system
NEXT_PUBLIC_DEFAULT_SIGNUP_ROLE=dealer
```

## 8. Why this works with current Collectra code

- Backend reads `SUPABASE_EMAIL_REDIRECT_URL`, `SUPABASE_RESET_REDIRECT_URL`, and `SUPABASE_OAUTH_REDIRECT_URL` and passes them to auth service.
- During sign-up, the API calls Supabase `auth.signUp(...)` with `emailRedirectTo`.
- If email confirmation is required, session is not created immediately and frontend already shows "check your email" state.
- `/auth/verify` page handles confirmation success UX and sends user to login.

## 9. End-to-end test checklist

1. Start API and web apps.
2. Register a brand new user from `/auth/sign-up`.
3. Confirm you are redirected to sign-up success page.
4. Check mailbox for confirmation email sent from your domain sender.
5. Click confirmation link.
6. Confirm user lands on `/auth/verify`, then is redirected to `/auth/login`.
7. Login should now work.

## 10. Troubleshooting

If no email is sent:

1. Check Supabase logs in **Authentication**.
2. Verify custom SMTP credentials in Supabase.
3. Verify Brevo domain/sender is fully validated.
4. Confirm SPF/DKIM DNS records are correct.

If link opens but verification fails:

1. Confirm redirect URL exactly matches a URL in Supabase Redirect URLs.
2. Confirm `SUPABASE_EMAIL_REDIRECT_URL` points to your correct frontend domain.
3. Check if link is expired and resend confirmation.

If email lands in spam:

1. Add DMARC record.
2. Use a sender at your verified domain.
3. Avoid suspicious email subject/content in templates.

---

If you want, the next step is to add a second guide with exact DNS records format for your registrar (Cloudflare/Namecheap/GoDaddy) and a production deployment checklist for `api.your-domain.com` + `collectra.xyz`.

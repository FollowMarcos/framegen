# Security policy

This is a small open-source project maintained in spare time. I take security
reports seriously and will respond as quickly as I can.

## Reporting a vulnerability

**Please do not file public GitHub issues for security problems.**

Instead, report privately via one of:

- GitHub Security Advisories — open a draft advisory on this repo's
  **Security** tab (preferred).
- Email — see the address on my GitHub profile.

Please include:

- The version / commit SHA the issue reproduces against.
- A minimal repro: steps, payload, expected vs. actual behavior.
- Your assessment of impact (what does an attacker gain?).

I will acknowledge within **7 days** and aim to ship a fix or a documented
mitigation within **30 days** for critical issues. There's no bug bounty —
just a name in the release notes if you'd like one.

## Threat model

This app is designed to run **locally on a single operator's machine**, or on
a small self-hosted server behind a password gate. It is **not** designed to
be exposed to the open internet as a multi-tenant SaaS. Concretely:

| Asset                      | Trust boundary                                        |
| -------------------------- | ----------------------------------------------------- |
| `FAL_ADMIN_KEY`            | Server-side only; never exposed to the browser.       |
| `AUTH_SECRET`              | Server-side only; signs the session cookie.           |
| `APP_PASSWORD`             | The single gate between the public internet and fal-billed routes. |
| `public/generations/*`     | Local disk. Anything saved here is publicly served if the host is exposed. |

The password gate is the security boundary. If `APP_PASSWORD` is unset, the
app runs fully open — fine for `localhost` only.

## What's in scope

- Authentication / session bypass.
- Path traversal or arbitrary-file-write in any `/api/*` route.
- Server-side request forgery via the fal model dispatch.
- XSS via stored asset metadata (prompts, tags, snippets).
- Credential / API-key leakage to the client.
- Trivially-bypassable rate limiting on fal-billed routes
  (`/api/generate`, `/api/upscale`, `/api/outpaint`, `/api/upload`).

## What's out of scope

- Anything that requires the attacker to already control the host filesystem.
- The fal.ai service itself — please report those to fal directly.
- Browser extensions modifying the DOM (we use `suppressHydrationWarning`
  in a couple of places specifically because form-fillers do this).
- Denial-of-service via large input that takes time to process when the
  attacker is already authenticated.

## Hardening checklist for self-hosters

Even with the password gate, if you expose this on the public internet:

- [ ] Set a strong `APP_PASSWORD` (random, ≥ 24 chars).
- [ ] Set `AUTH_SECRET` to a unique random string.
- [ ] Run behind HTTPS (the auth cookie is `Secure` in production).
- [ ] Leave `ALLOW_CUSTOM_FAL_MODELS` unset (or `false`) unless you
      personally vet every model id used.
- [ ] Monitor your fal.ai billing dashboard — the in-app rate limit is
      best-effort, not authoritative.
- [ ] Keep the host updated.

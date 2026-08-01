/** Shared (browser-safe) input sanitisation for the admin login form. */
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
// Anything query-ish is rejected outright — never reaches the database.
const FORBIDDEN_RE =
  /['"`;\\]|--|\/\*|\*\/|[<>{}$()]|\b(select|union|insert|update|delete|drop)\b/i;

export function sanitizeEmail(raw: string): { ok: boolean; email: string; error?: string } {
  const email = (raw ?? "").trim().toLowerCase();
  if (!email) return { ok: false, email, error: "Enter your email address." };
  if (email.length > 254) return { ok: false, email, error: "That email address is too long." };
  if (FORBIDDEN_RE.test(email))
    return {
      ok: false,
      email,
      error: "That email address contains characters that are not allowed.",
    };
  if (!EMAIL_RE.test(email)) return { ok: false, email, error: "Enter a valid email address." };
  return { ok: true, email };
}

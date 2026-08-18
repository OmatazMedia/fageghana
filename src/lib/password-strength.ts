export type Strength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  /** Tailwind bg token class for the meter fill. */
  color: string;
  hints: string[];
};

/**
 * Lightweight, dependency-free password strength estimate.
 * Score 0–4 based on length and character-class variety, minus common patterns.
 */
export function passwordStrength(pw: string): Strength {
  const hints: string[] = [];
  if (!pw) {
    return { score: 0, label: "Empty", color: "bg-muted", hints: ["Enter a password"] };
  }

  let score = 0;
  if (pw.length >= 8) score++;
  else hints.push("Use at least 8 characters");
  if (pw.length >= 12) score++;
  else if (pw.length >= 8) hints.push("12+ characters is much stronger");

  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (classes >= 3) score++;
  else hints.push("Mix upper case, lower case, numbers and symbols");
  if (classes === 4 && pw.length >= 10) score++;

  // Penalise obvious patterns.
  const lowered = pw.toLowerCase();
  const common = ["password", "12345", "qwerty", "letmein", "fage", "admin", "welcome"];
  if (common.some((c) => lowered.includes(c))) {
    score = Math.max(0, score - 2);
    hints.push("Avoid common words and sequences");
  }
  if (/^(.)\1+$/.test(pw)) {
    score = 0;
    hints.push("Avoid repeated characters");
  }

  const clamped = Math.min(4, Math.max(0, score)) as 0 | 1 | 2 | 3 | 4;
  const label = ["Very weak", "Weak", "Fair", "Strong", "Very strong"][clamped];
  const color = [
    "bg-destructive",
    "bg-destructive",
    "bg-amber-500",
    "bg-emerald-500",
    "bg-emerald-600",
  ][clamped];
  return { score: clamped, label, color, hints };
}

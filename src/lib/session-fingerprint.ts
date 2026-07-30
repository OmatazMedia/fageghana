/**
 * Browser-safe device fingerprint + human-readable device labelling.
 * No third-party tracking libraries — just a stable hash of coarse
 * browser/device attributes used to recognise "this device" and to detect
 * a stolen token being replayed from a different machine.
 */

const FP_KEY = "fage.session.fp";

function hash(input: string): string {
  // FNV-1a 32-bit, doubled with a different offset for a 64-bit-ish value.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const a = (h1 >>> 0).toString(16).padStart(8, "0");
  const b = (h2 >>> 0).toString(16).padStart(8, "0");
  return a + b;
}

export function getFingerprint(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    const cached = localStorage.getItem(FP_KEY);
    if (cached) return cached;
  } catch {
    /* storage blocked */
  }
  const nav = window.navigator;
  const parts = [
    nav.userAgent,
    (nav as any).platform ?? "",
    nav.language,
    String(nav.hardwareConcurrency ?? ""),
    String((nav as any).deviceMemory ?? ""),
    `${window.screen?.width}x${window.screen?.height}x${window.screen?.colorDepth}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
  ];
  const fp = hash(parts.join("|"));
  try {
    localStorage.setItem(FP_KEY, fp);
  } catch {
    /* storage blocked */
  }
  return fp;
}

export function clearFingerprintCache() {
  try {
    localStorage.removeItem(FP_KEY);
  } catch {
    /* noop */
  }
}

export type DeviceInfo = {
  fingerprint: string;
  browser: string;
  os: string;
  deviceLabel: string;
};

export function getDeviceInfo(): DeviceInfo {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const browser =
    /Edg\//.test(ua) ? "Edge"
    : /OPR\//.test(ua) ? "Opera"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) ? "Safari"
    : "Browser";

  const os =
    /Windows NT/.test(ua) ? "Windows"
    : /Android/.test(ua) ? "Android"
    : /(iPhone|iPad|iPod)/.test(ua) ? "iOS"
    : /Mac OS X/.test(ua) ? "macOS"
    : /Linux/.test(ua) ? "Linux"
    : "Unknown OS";

  return {
    fingerprint: getFingerprint(),
    browser,
    os,
    deviceLabel: `${browser} on ${os}`,
  };
}

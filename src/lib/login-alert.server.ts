// Server-only helper: coarse IP geolocation for login-alert emails.
export async function describeLocation(ip: string | null): Promise<string> {
  if (!ip || ip === "unknown" || ip.startsWith("10.") || ip.startsWith("192.168.")) {
    return "Unknown location";
  }
  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) return "Unknown location";
    const j: any = await res.json();
    const parts = [j.city, j.region, j.country_name].filter(Boolean);
    return parts.length ? parts.join(", ") : "Unknown location";
  } catch {
    return "Unknown location";
  }
}

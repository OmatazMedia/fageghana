import { useMemo, useState } from "react";
import { X, Upload, AlertCircle, CheckCircle2, Download } from "lucide-react";
import { toast } from "sonner";
import { bulkInviteMembers, type BulkInviteResult } from "@/lib/users.functions";

type Row = {
  email: string;
  full_name: string;
  password?: string;
  phone?: string;
  company_name?: string;
  tier?: string;
  __error?: string;
};

const TIERS = new Set(["associate", "standard", "corporate"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SAMPLE_CSV = `email,full_name,password,phone,company_name,tier
jane@example.com,Jane Mensah,ChangeMe123!,+233201234567,Mensah Exports Ltd,associate
kofi@example.com,Kofi Boateng,ChangeMe123!,+233240000000,Boateng Agro Ltd,corporate
`;

function downloadSample() {
  const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "fage-members-sample.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function parseCsv(text: string): Row[] {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0]
    .split(",")
    .map((h) => h.trim().toLowerCase().replace(/^["']|["']$/g, ""));
  const idx = (name: string) => header.indexOf(name);
  const iEmail = idx("email");
  const iName = idx("full_name") >= 0 ? idx("full_name") : idx("name");
  const iPass = idx("password");
  const iPhone = idx("phone");
  const iCo = idx("company_name");
  const iTier = idx("tier");
  if (iEmail < 0 || iName < 0) {
    throw new Error("CSV must include 'email' and 'full_name' columns");
  }
  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]
      .split(",")
      .map((c) => c.trim().replace(/^["']|["']$/g, ""));
    const r: Row = {
      email: cols[iEmail] ?? "",
      full_name: cols[iName] ?? "",
      password: iPass >= 0 ? cols[iPass] : undefined,
      phone: iPhone >= 0 ? cols[iPhone] : undefined,
      company_name: iCo >= 0 ? cols[iCo] : undefined,
      tier: iTier >= 0 ? cols[iTier] : undefined,
    };
    if (!EMAIL_RE.test(r.email)) r.__error = "Invalid email";
    else if (!r.full_name) r.__error = "Missing full_name";
    else if (r.password && r.password.length < 8)
      r.__error = "Password must be at least 8 characters";
    else if (r.tier && !TIERS.has(r.tier.toLowerCase()))
      r.__error = "tier must be associate, standard or corporate";
    rows.push(r);
  }
  return rows;
}


export function BulkInviteMembersDialog({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BulkInviteResult | null>(null);
  const inviteFn = bulkInviteMembers;

  const valid = useMemo(() => rows.filter((r) => !r.__error), [rows]);
  const invalid = useMemo(() => rows.filter((r) => r.__error), [rows]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    try {
      const text = await f.text();
      const parsed = parseCsv(text);
      setRows(parsed);
      setResult(null);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to parse CSV");
      setRows([]);
    }
  }

  async function submit() {
    if (!valid.length) return;
    setBusy(true);
    try {
      const res = await inviteFn({
        data: {
          rows: valid.map((r) => ({
            email: r.email,
            full_name: r.full_name,
            password: r.password || null,

            phone: r.phone || null,
            company_name: r.company_name || null,
            tier: (r.tier?.toLowerCase() as any) || null,
          })),
          redirectOrigin: window.location.origin,
        },
      });
      setResult(res);
      if (res.succeeded) {
        toast.success(
          `Invited ${res.succeeded} member${res.succeeded === 1 ? "" : "s"}${res.failed.length ? `, ${res.failed.length} failed` : ""}`,
        );
        onDone();
      } else {
        toast.error("No members were invited — see errors below");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Bulk invite failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold">Import members via CSV</h3>
            <p className="text-xs text-muted-foreground">
              Columns: <code>email, full_name, password</code> (optional:{" "}
              <code>phone, company_name, tier</code>). With a password the account is created
              confirmed so the member can sign in immediately; leave it blank to send an invite
              link instead.
            </p>

          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[calc(90vh-150px)] overflow-auto px-6 py-5">
          <div className="mb-3 flex justify-end">
            <button
              onClick={downloadSample}
              className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              <Download className="h-3.5 w-3.5" /> Download sample CSV
            </button>
          </div>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 px-6 py-8 hover:bg-muted/50">
            <Upload className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm font-medium">
              {fileName || "Click to choose a .csv file"}
            </span>
            <span className="text-xs text-muted-foreground">
              Max 500 rows per upload · passwords must be at least 8 characters
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={onFile}
            />
          </label>


          {rows.length > 0 && (
            <div className="mt-5">
              <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" /> {valid.length} ready
                </span>
                {invalid.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 font-semibold text-destructive">
                    <AlertCircle className="h-3 w-3" /> {invalid.length} invalid
                  </span>
                )}
              </div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 text-left">
                    <tr>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Full name</th>
                      <th className="px-3 py-2">Password</th>

                      <th className="px-3 py-2">Phone</th>
                      <th className="px-3 py-2">Company</th>
                      <th className="px-3 py-2">Tier</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 200).map((r, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-1.5">{r.email}</td>
                        <td className="px-3 py-1.5">{r.full_name}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">
                          {r.password ? "••••••••" : "invite link"}
                        </td>

                        <td className="px-3 py-1.5">{r.phone}</td>
                        <td className="px-3 py-1.5">{r.company_name}</td>
                        <td className="px-3 py-1.5">{r.tier}</td>
                        <td className="px-3 py-1.5">
                          {r.__error ? (
                            <span className="text-destructive">{r.__error}</span>
                          ) : (
                            <span className="text-emerald-600">OK</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 200 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    Showing first 200 of {rows.length} rows…
                  </div>
                )}
              </div>
            </div>
          )}

          {result && (
            <div className="mt-5 rounded-lg border border-border bg-muted/30 p-4 text-sm">
              <div className="font-semibold">
                Imported {result.succeeded} · Failed {result.failed.length}
              </div>
              {result.failed.length > 0 && (
                <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs text-destructive">
                  {result.failed.map((f, i) => (
                    <li key={i}>
                      <span className="font-mono">{f.email}</span> — {f.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/30 px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Close
          </button>
          <button
            onClick={submit}
            disabled={!valid.length || busy}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy
              ? "Inviting…"
              : `Import ${valid.length} member${valid.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import {
  FileText,
  FileSpreadsheet,
  Download,
  Users,
  CreditCard,
  ClipboardList,
  Loader2,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/integrations/api/client";
import { generateWordDocument } from "@/lib/wordDocument";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({ meta: [{ title: "Reports & Exports — Admin" }] }),
  component: Reports,
});

// ── CSV helper ────────────────────────────────────────────────────────────
function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── PDF helper ────────────────────────────────────────────────────────────
function downloadPDF(title: string, headers: string[], rows: string[][], filename: string) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text(title, 14, 18);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 25);
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 30,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [34, 139, 34], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 245] },
  });
  doc.save(filename);
}

// ── Report card ───────────────────────────────────────────────────────────
function ReportCard({
  icon: Icon,
  title,
  description,
  count,
  countLabel,
  loading,
  onExportCSV,
  onExportPDF,
  onExportWord,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  count: number;
  countLabel: string;
  loading: boolean;
  onExportCSV: () => void;
  onExportPDF: () => void;
  onExportWord: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary">
          <Icon className="h-5 w-5" />
        </div>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <span className="text-2xl font-bold text-primary">{count.toLocaleString()}</span>
        )}
      </div>
      <h3 className="font-bold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {!loading && (
        <p className="mt-1 text-xs text-muted-foreground">
          {count.toLocaleString()} {countLabel}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
        <button
          onClick={onExportCSV}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-accent transition disabled:opacity-50 cursor-pointer"
        >
          <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> CSV
        </button>
        <button
          onClick={onExportPDF}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-accent transition disabled:opacity-50 cursor-pointer"
        >
          <FileText className="h-3.5 w-3.5 text-red-500" /> PDF
        </button>
        <button
          onClick={onExportWord}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-accent transition disabled:opacity-50 cursor-pointer"
        >
          <Download className="h-3.5 w-3.5 text-blue-600" /> Word
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────
function Reports() {
  const [members, setMembers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [m, p, a] = await Promise.all([
      supabase
        .from("member_profiles")
        .select(
          "contact_name,company_name,email,phone,tier,member_id,subscription_expiry,country,status",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("payment_submissions")
        .select(
          "user_id,amount,currency,method,status,reference,created_at,confirmed_at,member_message,member_profiles(contact_name,company_name,email)",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("membership_applications")
        .select("contact_name,company_name,email,phone,tier,status,country,created_at")
        .order("created_at", { ascending: false }),
    ]);
    setMembers(m.data ?? []);
    setPayments(p.data ?? []);
    setApplications(a.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Members ──
  const memberHeaders = [
    "Contact Name",
    "Company",
    "Email",
    "Phone",
    "Tier",
    "Member ID",
    "Status",
    "Expiry",
    "Country",
  ];
  const memberRows = members.map((m) => [
    m.contact_name ?? "",
    m.company_name ?? "",
    m.email ?? "",
    m.phone ?? "",
    m.tier ?? "",
    m.member_id ?? "Pending",
    m.status ?? "",
    m.subscription_expiry ? new Date(m.subscription_expiry).toLocaleDateString() : "—",
    m.country ?? "",
  ]);

  // ── Payments ──
  const paymentHeaders = [
    "Contact Name",
    "Company",
    "Email",
    "Amount",
    "Currency",
    "Method",
    "Status",
    "Reference",
    "Date",
    "Confirmed",
  ];
  const paymentRows = payments.map((p) => [
    (p.member_profiles as any)?.contact_name ?? "",
    (p.member_profiles as any)?.company_name ?? "",
    (p.member_profiles as any)?.email ?? "",
    String(p.amount),
    p.currency ?? "",
    p.method ?? "",
    p.status ?? "",
    p.reference ?? "—",
    new Date(p.created_at).toLocaleDateString(),
    p.confirmed_at ? new Date(p.confirmed_at).toLocaleDateString() : "—",
  ]);

  // ── Applications ──
  const appHeaders = [
    "Contact Name",
    "Company",
    "Email",
    "Phone",
    "Tier",
    "Status",
    "Country",
    "Date",
  ];
  const appRows = applications.map((a) => [
    a.contact_name ?? "",
    a.company_name ?? "",
    a.email ?? "",
    a.phone ?? "",
    a.tier ?? "",
    a.status ?? "",
    a.country ?? "",
    new Date(a.created_at).toLocaleDateString(),
  ]);

  const date = new Date().toISOString().slice(0, 10);

  return (
    <AdminShell
      title="Reports & Exports"
      description="Export member, payment and application data in PDF, CSV or Word format."
    >
      {/* Summary bar */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            label: "Total Members",
            value: members.length,
            color: "text-blue-600",
            bg: "bg-blue-50",
          },
          {
            label: "Total Payments",
            value: payments.length,
            color: "text-emerald-600",
            bg: "bg-emerald-50",
          },
          {
            label: "Total Applications",
            value: applications.length,
            color: "text-amber-600",
            bg: "bg-amber-50",
          },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl ${s.bg} p-5`}>
            <div className={`text-3xl font-bold ${s.color}`}>
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : s.value.toLocaleString()}
            </div>
            <div className="mt-1 text-sm font-medium text-foreground/70">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Export cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Members */}
        <ReportCard
          icon={Users}
          title="Member Directory"
          loading={loading}
          description="All registered members with contact details, tier, status and subscription expiry."
          count={members.length}
          countLabel="members"
          onExportCSV={() => downloadCSV(`fage-members-${date}.csv`, memberHeaders, memberRows)}
          onExportPDF={() =>
            downloadPDF(
              "FAGE Ghana — Member Directory",
              memberHeaders,
              memberRows,
              `fage-members-${date}.pdf`,
            )
          }
          onExportWord={() =>
            generateWordDocument({
              title: "FAGE Ghana — Member Directory",
              tableData: { headers: memberHeaders, rows: memberRows },
              fileName: `fage-members-${date}.doc`,
            })
          }
        />

        {/* Payments */}
        <ReportCard
          icon={CreditCard}
          title="Payment History"
          loading={loading}
          description="All payment submissions with amounts, methods, status and confirmation dates."
          count={payments.length}
          countLabel="payment records"
          onExportCSV={() => downloadCSV(`fage-payments-${date}.csv`, paymentHeaders, paymentRows)}
          onExportPDF={() =>
            downloadPDF(
              "FAGE Ghana — Payment History",
              paymentHeaders,
              paymentRows,
              `fage-payments-${date}.pdf`,
            )
          }
          onExportWord={() =>
            generateWordDocument({
              title: "FAGE Ghana — Payment History",
              tableData: { headers: paymentHeaders, rows: paymentRows },
              fileName: `fage-payments-${date}.doc`,
            })
          }
        />

        {/* Applications */}
        <ReportCard
          icon={ClipboardList}
          title="Applications"
          loading={loading}
          description="All membership applications with contact details, tier applied for and current status."
          count={applications.length}
          countLabel="applications"
          onExportCSV={() => downloadCSV(`fage-applications-${date}.csv`, appHeaders, appRows)}
          onExportPDF={() =>
            downloadPDF(
              "FAGE Ghana — Membership Applications",
              appHeaders,
              appRows,
              `fage-applications-${date}.pdf`,
            )
          }
          onExportWord={() =>
            generateWordDocument({
              title: "FAGE Ghana — Membership Applications",
              tableData: { headers: appHeaders, rows: appRows },
              fileName: `fage-applications-${date}.doc`,
            })
          }
        />
      </div>
    </AdminShell>
  );
}

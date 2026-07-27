import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ThumbsUp, ThumbsDown, Star, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/admin/chatbot-feedback")({
  head: () => ({ meta: [{ title: "Chatbot Feedback — Admin" }] }),
  component: ChatbotFeedbackPage,
});

type Row = {
  id: string;
  kind: "reply" | "session";
  helpful: boolean | null;
  rating: number | null;
  comment: string | null;
  question: string | null;
  bot_reply: string | null;
  transcript: any;
  session_id: string;
  user_id: string | null;
  page_url: string | null;
  created_at: string;
};

const PAGE = 25;

function ChatbotFeedbackPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"unhelpful" | "sessions" | "all">("unhelpful");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("chatbot_feedback" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    setRows(((data as any) ?? []) as Row[]);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (tab === "unhelpful") return rows.filter((r) => r.kind === "reply" && r.helpful === false);
    if (tab === "sessions") return rows.filter((r) => r.kind === "session");
    return rows;
  }, [rows, tab]);

  const paged = filtered.slice(page * PAGE, (page + 1) * PAGE);

  const stats = useMemo(() => {
    const cutoff = Date.now() - 30 * 86400_000;
    const recent = rows.filter((r) => new Date(r.created_at).getTime() >= cutoff);
    const replies = recent.filter((r) => r.kind === "reply" && r.helpful !== null);
    const helpful = replies.filter((r) => r.helpful).length;
    const sessions = recent.filter((r) => r.kind === "session" && r.rating);
    const avg = sessions.length
      ? sessions.reduce((s, r) => s + (r.rating ?? 0), 0) / sessions.length
      : 0;
    return {
      total: recent.length,
      pct: replies.length ? Math.round((helpful / replies.length) * 100) : null,
      avg: avg ? avg.toFixed(1) : null,
      sessions: sessions.length,
    };
  }, [rows]);

  useEffect(() => setPage(0), [tab]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Chatbot Feedback</h1>
        <p className="text-sm text-muted-foreground">
          What users think of Ama's answers. Use unhelpful replies to spot gaps in the Chatbot Knowledge Base.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Feedback (30d)" value={String(stats.total)} icon={<MessageSquare className="w-4 h-4" />} />
        <StatCard label="Helpful %" value={stats.pct === null ? "—" : `${stats.pct}%`} icon={<ThumbsUp className="w-4 h-4" />} />
        <StatCard label="Avg. rating" value={stats.avg ?? "—"} icon={<Star className="w-4 h-4" />} />
        <StatCard label="Sessions rated" value={String(stats.sessions)} icon={<Star className="w-4 h-4" />} />
      </div>

      <div className="flex gap-2 border-b border-border">
        {[
          { k: "unhelpful", label: "Unhelpful replies" },
          { k: "sessions", label: "Session ratings" },
          { k: "all", label: "All feedback" },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              tab === t.k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div>Loading…</div>
      ) : paged.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center border rounded-lg">
          No feedback yet in this view.
        </div>
      ) : (
        <div className="space-y-3">
          {paged.map((r) => (
            <div key={r.id} className="border rounded-lg p-4 bg-card space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 text-sm">
                  {r.kind === "reply" ? (
                    r.helpful ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600"><ThumbsUp className="w-4 h-4" /> Helpful</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-destructive"><ThumbsDown className="w-4 h-4" /> Not helpful</span>
                    )
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-600">
                      {Array.from({ length: r.rating ?? 0 }).map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-current" />
                      ))}
                      {r.rating ?? "—"}/5
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                </div>
              </div>

              {r.question && (
                <div className="text-sm">
                  <div className="text-xs text-muted-foreground">User asked</div>
                  <div className="font-medium">{r.question}</div>
                </div>
              )}
              {r.bot_reply && (
                <div className="text-sm">
                  <div className="text-xs text-muted-foreground">Bot replied</div>
                  <div className="whitespace-pre-wrap text-muted-foreground">{r.bot_reply}</div>
                </div>
              )}
              {r.comment && (
                <div className="text-sm">
                  <div className="text-xs text-muted-foreground">Comment</div>
                  <div className="whitespace-pre-wrap">{r.comment}</div>
                </div>
              )}
              {r.transcript && Array.isArray(r.transcript) && r.transcript.length > 0 && (
                <div className="text-sm">
                  <button
                    className="text-xs text-primary hover:underline"
                    onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                  >
                    {expanded === r.id ? "Hide" : "Show"} transcript ({r.transcript.length} messages)
                  </button>
                  {expanded === r.id && (
                    <pre className="mt-2 p-3 bg-muted rounded text-xs whitespace-pre-wrap max-h-80 overflow-auto">
                      {r.transcript
                        .map((m: any) => `${m.from === "user" ? "User" : "Ama"}: ${m.text ?? ""}`)
                        .join("\n")}
                    </pre>
                  )}
                </div>
              )}
              {r.page_url && (
                <div className="text-xs text-muted-foreground truncate">From: {r.page_url}</div>
              )}
            </div>
          ))}

          {filtered.length > PAGE && (
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="btn-outline px-3 py-1 rounded text-sm disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-muted-foreground">
                Page {page + 1} of {Math.ceil(filtered.length / PAGE)}
              </span>
              <button
                onClick={() => setPage((p) => (p + 1) * PAGE < filtered.length ? p + 1 : p)}
                disabled={(page + 1) * PAGE >= filtered.length}
                className="btn-outline px-3 py-1 rounded text-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="border rounded-lg p-4 bg-card">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon} {label}
      </div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

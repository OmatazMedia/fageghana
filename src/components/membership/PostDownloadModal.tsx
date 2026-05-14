import { useEffect, useState } from "react";
import { CheckCircle2, X } from "lucide-react";

const AUTO_CLOSE_MS = 40_000;

export function PostDownloadModal({
  open,
  onClose,
  planName,
  message,
}: {
  open: boolean;
  onClose: () => void;
  planName: string;
  message: string;
}) {
  const [secondsLeft, setSecondsLeft] = useState(AUTO_CLOSE_MS / 1000);

  useEffect(() => {
    if (!open) return;
    setSecondsLeft(AUTO_CLOSE_MS / 1000);
    const tick = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    const timeout = setTimeout(onClose, AUTO_CLOSE_MS);
    return () => {
      clearInterval(tick);
      clearTimeout(timeout);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-background/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-7 shadow-2xl">
        <button
          aria-label="Close"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" /> Form downloaded
        </div>

        <h2 className="text-xl font-bold">{planName}</h2>
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
          {message}
        </p>

        <div className="mt-6 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Closes automatically in {secondsLeft}s
          </span>
          <button
            onClick={onClose}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            I&apos;ve got it
          </button>
        </div>
      </div>
    </div>
  );
}

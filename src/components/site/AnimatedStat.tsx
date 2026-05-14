import { useInView, useCountUp } from "@/hooks/use-in-view";

type Props = {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  label: string;
  noSeparator?: boolean;
};

export function AnimatedStat({ value, prefix = "", suffix = "", decimals = 0, label, noSeparator = false }: Props) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const v = useCountUp(value, 1800, inView);
  const formatted = decimals
    ? v.toFixed(decimals)
    : noSeparator
    ? String(Math.round(v))
    : Math.round(v).toLocaleString();
  return (
    <div ref={ref} className={`reveal ${inView ? "in-view" : ""} rounded-2xl border border-border p-10`}>
      <div className="text-5xl font-bold text-primary">
        {prefix}{formatted}{suffix}
      </div>
      <div className="mt-3 text-sm uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

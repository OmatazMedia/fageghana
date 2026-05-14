import { type ReactNode, type ElementType } from "react";
import { useInView } from "@/hooks/use-in-view";

type Variant = "up" | "down" | "left" | "right" | "scale" | "fade";

type Props = {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  variant?: Variant;
  delay?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
};

const variantClass: Record<Variant, string> = {
  up:    "reveal",
  down:  "reveal-down",
  left:  "reveal-left",
  right: "reveal-right",
  scale: "reveal-scale",
  fade:  "reveal-fade",
};

export function Reveal({
  children,
  as: Tag = "div",
  className = "",
  variant = "up",
  delay = 0,
}: Props) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const base = variantClass[variant];
  const delayClass = delay ? `reveal-delay-${delay}` : "";

  return (
    <Tag
      ref={ref}
      className={`${base} ${delayClass} ${inView ? "in-view" : ""} ${className}`}
    >
      {children}
    </Tag>
  );
}

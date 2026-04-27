import { type ReactNode, type ElementType } from "react";
import { useInView } from "@/hooks/use-in-view";

type Props = {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  variant?: "up" | "left" | "right";
  delay?: 0 | 1 | 2 | 3 | 4;
};

export function Reveal({ children, as: Tag = "div", className = "", variant = "up", delay = 0 }: Props) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const variantClass = variant === "left" ? "reveal-left" : variant === "right" ? "reveal-right" : "";
  const delayClass = delay ? `reveal-delay-${delay}` : "";
  return (
    <Tag ref={ref} className={`reveal ${variantClass} ${delayClass} ${inView ? "in-view" : ""} ${className}`}>
      {children}
    </Tag>
  );
}

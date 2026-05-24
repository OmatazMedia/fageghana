import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export function BackToTop({ onVisibilityChange }: { onVisibilityChange?: (v: boolean) => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      const v = window.scrollY > 400;
      setVisible(prev => {
        if (prev !== v) onVisibilityChange?.(v);
        return v;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [onVisibilityChange]);

  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`fixed right-6 bottom-6 z-[98] flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all duration-300 hover:scale-110 ${
        visible ? "opacity-100 pointer-events-auto translate-y-0" : "opacity-0 pointer-events-none translate-y-4"
      }`}
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}

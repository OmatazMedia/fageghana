import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

type BaseProps = {
  children: ReactNode;
  className?: string;
};

type LinkProps = BaseProps & {
  to: string;
  params?: Record<string, string>;
  onClick?: never;
  type?: never;
  disabled?: never;
};

type ButtonProps = BaseProps & {
  to?: never;
  params?: never;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
};

type AnimBtnProps = LinkProps | ButtonProps;

/**
 * Primary CTA button with the same circle-slides-right animation as the navbar "Let's Talk".
 * Use `to` for navigation, omit it for a plain button.
 */
export function AnimBtn({ children, className = "", ...rest }: AnimBtnProps) {
  const inner = (
    <>
      <span className="lets-talk-circle">
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
          />
        </svg>
      </span>
      <span className="lets-talk-text">{children}</span>
    </>
  );

  if ("to" in rest && rest.to) {
    return (
      <Link
        to={rest.to}
        params={rest.params}
        className={`lets-talk-btn ${className}`}
        style={{ width: "auto", minWidth: 160 }}
      >
        {inner}
      </Link>
    );
  }

  return (
    <button
      type={(rest as ButtonProps).type ?? "button"}
      onClick={(rest as ButtonProps).onClick}
      disabled={(rest as ButtonProps).disabled}
      className={`lets-talk-btn ${className}`}
      style={{ width: "auto", minWidth: 160 }}
    >
      {inner}
    </button>
  );
}

"use client";

import { useState, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

interface ActionButtonProps {
  label: string;
  labelDoing: string;
  labelDone?: string;
  onAction: () => Promise<void>;
  variant?: Variant;
  className?: string;
  disabled?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-verde-profundo text-off-white hover:bg-verde-profundo/90",
  secondary: "bg-verde-oliva text-off-white hover:bg-verde-oliva/90",
  danger: "bg-terracota text-off-white hover:bg-terracota/90",
  ghost: "bg-creme text-verde-profundo hover:bg-creme/70",
};

// Every actionable button follows: rótulo → "Fazendo…" → "Feito ✓" (or an
// inline error with a retry), so a seller on a phone always knows the tap
// registered instead of wondering whether to tap again.
export default function ActionButton({
  label,
  labelDoing,
  labelDone,
  onAction,
  variant = "primary",
  className = "",
  disabled = false,
  icon,
  fullWidth = true,
}: ActionButtonProps) {
  const [state, setState] = useState<"idle" | "doing" | "done" | "error">("idle");

  async function handleClick() {
    if (state === "doing") return;
    setState("doing");
    try {
      await onAction();
      if (labelDone) {
        setState("done");
        setTimeout(() => setState("idle"), 1800);
      } else {
        setState("idle");
      }
    } catch {
      setState("error");
    }
  }

  const text =
    state === "doing" ? labelDoing : state === "done" ? labelDone : state === "error" ? "ERRO — TENTAR NOVAMENTE" : label;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || state === "doing"}
      aria-busy={state === "doing"}
      className={`tap-target flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-60 ${
        fullWidth ? "w-full" : ""
      } ${state === "error" ? "bg-terracota text-off-white" : variantClasses[variant]} ${className}`}
    >
      {state === "doing" && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-off-white/40 border-t-off-white" />
      )}
      {state === "idle" && icon}
      <span>{text}</span>
      {state === "done" && <span aria-hidden>✓</span>}
    </button>
  );
}

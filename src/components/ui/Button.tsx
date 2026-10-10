"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-sans font-medium " +
  "transition-colors duration-200 ease-out disabled:opacity-50 " +
  "disabled:cursor-not-allowed select-none active:scale-[0.98]";

const variantStyles: Record<Variant, string> = {
  primary: "bg-navy text-white px-6 py-3 hover:bg-navy-soft",
  secondary:
    "bg-transparent border border-hairline text-navy px-5 py-2.5 " +
    "hover:border-gold-deep hover:bg-white/60",
  danger: "bg-danger text-white px-5 py-2.5 hover:bg-danger-soft",
  ghost: "bg-transparent text-navy-soft px-3 py-2 hover:text-navy underline",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", className = "", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`${base} ${variantStyles[variant]} ${className}`}
      {...props}
    />
  );
});

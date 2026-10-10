"use client";

import { InputHTMLAttributes, forwardRef } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, hint, error, id, className = "", ...props },
  ref,
) {
  const inputId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-navy-soft">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={
          "rounded-lg border border-hairline bg-bg-elevated px-4 py-2.5 text-navy " +
          "placeholder:text-navy-soft/50 focus-visible:border-gold-deep " +
          (error ? "border-danger " : "") +
          className
        }
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        {...props}
      />
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-xs text-navy-soft/70">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${inputId}-error`} className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});

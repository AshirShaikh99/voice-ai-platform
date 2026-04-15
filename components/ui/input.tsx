import * as React from "react";

import { cn } from "@/lib/cn";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ className, type = "text", ...rest }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "h-10 w-full rounded-[6px] border border-rule bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
          "disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
        {...rest}
      />
    );
  },
);

type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ className, ...rest }: LabelProps) {
  return (
    <label
      className={cn(
        "text-[13px] font-medium text-ink tracking-tight",
        className,
      )}
      {...rest}
    />
  );
}

type FieldProps = {
  label: string;
  hint?: string;
  id: string;
  children: React.ReactNode;
};

export function Field({ label, hint, id, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-[12px] text-ink-subtle">{hint}</p>}
    </div>
  );
}

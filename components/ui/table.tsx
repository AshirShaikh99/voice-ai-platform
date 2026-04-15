import * as React from "react";

import { cn } from "@/lib/cn";

export function Table({
  className,
  ...rest
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={cn("w-full border-collapse text-[14px]", className)}
        {...rest}
      />
    </div>
  );
}

export function THead({
  className,
  ...rest
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        "text-[11px] uppercase tracking-[0.08em] text-ink-subtle",
        className,
      )}
      {...rest}
    />
  );
}

export function TBody({
  className,
  ...rest
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn(className)} {...rest} />;
}

export function TR({
  className,
  ...rest
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("border-b border-rule last:border-b-0", className)}
      {...rest}
    />
  );
}

export function TH({
  className,
  ...rest
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "text-left font-medium px-6 py-3 border-b border-rule",
        className,
      )}
      {...rest}
    />
  );
}

export function TD({
  className,
  ...rest
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("px-6 py-4 text-ink align-middle", className)}
      {...rest}
    />
  );
}

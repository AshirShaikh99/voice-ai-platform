"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

type NavItem = {
  href: (slug: string) => string;
  label: string;
  icon: React.ReactNode;
  match: (pathname: string, slug: string) => boolean;
};

const NAV: NavItem[] = [
  {
    href: (s) => `/orgs/${s}/dashboard`,
    label: "Dashboard",
    icon: <IconGrid />,
    match: (p, s) => p.startsWith(`/orgs/${s}/dashboard`),
  },
  {
    href: (s) => `/orgs/${s}/agents`,
    label: "Agents",
    icon: <IconWave />,
    match: (p, s) => p.startsWith(`/orgs/${s}/agents`),
  },
  {
    href: (s) => `/orgs/${s}/phone`,
    label: "Phone",
    icon: <IconPhone />,
    match: (p, s) => p.startsWith(`/orgs/${s}/phone`),
  },
  {
    href: (s) => `/orgs/${s}/knowledge`,
    label: "Knowledge",
    icon: <IconBook />,
    match: (p, s) => p.startsWith(`/orgs/${s}/knowledge`),
  },
  {
    href: (s) => `/orgs/${s}/campaigns`,
    label: "Campaigns",
    icon: <IconMegaphone />,
    match: (p, s) => p.startsWith(`/orgs/${s}/campaigns`),
  },
  {
    href: (s) => `/orgs/${s}/team`,
    label: "Team",
    icon: <IconUsers />,
    match: (p, s) => p.startsWith(`/orgs/${s}/team`),
  },
  {
    href: (s) => `/orgs/${s}/settings`,
    label: "Settings",
    icon: <IconSliders />,
    match: (p, s) => p.startsWith(`/orgs/${s}/settings`),
  },
];

export function AppSidebar({ slug }: { slug: string }) {
  const pathname = usePathname() ?? "";
  return (
    <aside className="hidden w-56 shrink-0 lg:block">
      <nav className="sticky top-24 flex flex-col gap-1">
        <div className="mb-3 px-3 text-[10px] font-medium uppercase tracking-[0.12em] text-ink-subtle">
          Workspace
        </div>
        {NAV.map((item) => {
          const active = item.match(pathname, slug);
          return (
            <Link
              key={item.label}
              href={item.href(slug)}
              className={cn(
                "group flex h-9 items-center gap-2.5 rounded-[6px] px-3 text-[13px] transition-colors",
                active
                  ? "border border-rule bg-surface text-ink font-medium"
                  : "text-ink-muted hover:bg-surface-muted hover:text-ink",
              )}
            >
              <span
                className={cn(
                  "flex size-4 items-center justify-center",
                  active ? "text-ink" : "text-ink-subtle",
                )}
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}

        <div className="mt-8 rounded-[10px] border border-rule bg-surface p-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-subtle">
            Help
          </div>
          <p className="mt-2 text-[12px] leading-[1.55] text-ink-muted">
            Designing your first agent? Work from a small draft, let it
            listen for a day, then tighten its voice.
          </p>
          <Link
            href="#"
            className="mt-3 inline-flex text-[12px] font-medium text-ink hover:underline underline-offset-4"
          >
            Field notes →
          </Link>
        </div>
      </nav>
    </aside>
  );
}

function IconGrid() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="1.5" y="1.5" width="4.5" height="4.5" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
      <rect x="8" y="1.5" width="4.5" height="4.5" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
      <rect x="1.5" y="8" width="4.5" height="4.5" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
      <rect x="8" y="8" width="4.5" height="4.5" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function IconWave() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="1" y="5" width="2" height="4" rx="0.5" fill="currentColor" />
      <rect x="4" y="3" width="2" height="8" rx="0.5" fill="currentColor" />
      <rect x="7" y="1" width="2" height="12" rx="0.5" fill="currentColor" />
      <rect x="10" y="4" width="2" height="6" rx="0.5" fill="currentColor" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="5" cy="4.5" r="2.3" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1.2 12c.4-2.2 2-3.5 3.8-3.5S8.4 9.8 8.8 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="10.5" cy="5" r="1.8" stroke="currentColor" strokeWidth="1.2" />
      <path d="M9 12c.3-1.6 1.3-2.6 2.5-2.6s2.2 1 2.5 2.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M3 2h2.2l1 2.4-1.5 1.1c.6 1.5 1.8 2.7 3.3 3.3l1.1-1.5L11.5 8.3V10.5c0 .8-.7 1.5-1.5 1.5C6 12 2 8 2 3.5 2 2.7 2.7 2 3 2z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBook() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M2 2.5A.5.5 0 0 1 2.5 2H6c.6 0 1 .4 1 1v9c0-.6-.4-1-1-1H2.5a.5.5 0 0 1-.5-.5v-8Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M12 2.5a.5.5 0 0 0-.5-.5H8c-.6 0-1 .4-1 1v9c0-.6.4-1 1-1h3.5a.5.5 0 0 0 .5-.5v-8Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

function IconMegaphone() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M2 5.5v3c0 .3.3.5.5.5H4l1.5 3a.5.5 0 0 0 .9 0L7 10l4.5 1.5a.5.5 0 0 0 .5-.5V3a.5.5 0 0 0-.5-.5L7 4H2.5a.5.5 0 0 0-.5.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSliders() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2 4h6M10 4h2M2 10h2M6 10h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="9" cy="4" r="1.3" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="5" cy="10" r="1.3" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

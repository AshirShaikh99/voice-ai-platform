import Link from "next/link";

import { Wordmark } from "@/components/ui/wordmark";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col bg-canvas">
      <AmbientLight />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 pt-8">
        <Wordmark />
        <Link href="/" className="text-[13px] text-ink-muted hover:text-ink">
          Back to overview
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-14 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <aside className="hidden lg:block">
            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-subtle">
              Voice AI · for teams that measure
            </span>
            <h1 className="mt-4 font-serif text-[48px] leading-[1.05] tracking-[-0.03em] text-ink">
              Voice agents
              <br />
              <span className="italic text-ink-muted">
                your team actually trusts.
              </span>
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-[1.65] text-ink-muted">
              Draft an agent in plain language, ground it in your knowledge,
              and put it on a real phone line. Every call transcribed, every
              exception queued for review.
            </p>
            <dl className="mt-10 space-y-4 border-t border-rule pt-6 text-[13px] text-ink-muted">
              <BulletRow k="Drafts" v="Write an agent like you'd brief a new hire" />
              <BulletRow k="Handoff" v="One-tap escalation to a teammate on the line" />
              <BulletRow k="Review" v="Every call is searchable, flaggable, and coachable" />
            </dl>
          </aside>

          <div className="flex justify-center">{children}</div>
        </div>
      </main>

      <footer className="border-t border-rule py-6 text-center text-[12px] text-ink-subtle">
        Your workspace stays private to your team. You can invite members once
        you&apos;re inside.
      </footer>
    </div>
  );
}

function BulletRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline gap-4">
      <dt className="w-20 text-[10px] font-medium uppercase tracking-[0.12em] text-ink-subtle">
        {k}
      </dt>
      <dd>{v}</dd>
    </div>
  );
}

function AmbientLight() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-[540px]"
      style={{
        background:
          "radial-gradient(ellipse 70% 55% at 50% 0%, rgba(220, 200, 160, 0.06), transparent 70%)",
      }}
    />
  );
}

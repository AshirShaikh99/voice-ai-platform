import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { BRAND } from "@/lib/brand";
import { Wordmark } from "@/components/ui/wordmark";

export default async function LandingPage() {
  const { userId, orgSlug } = await auth();

  if (userId) {
    redirect(orgSlug ? `/orgs/${orgSlug}/dashboard` : "/select-org");
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-canvas">
      <SiteNav />
      <main className="flex-1">
        <Hero />
        <Capabilities />
        <Workflow />
        <Testimony />
        <ClosingCTA />
      </main>
      <SiteFooter />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Navigation
   ──────────────────────────────────────────────────────────────── */

function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-canvas/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Wordmark showSuffix />
        <nav className="hidden items-center gap-9 text-[13px] text-ink-muted sm:flex">
          <a href="#capabilities" className="transition-colors hover:text-ink">
            Capabilities
          </a>
          <a href="#workflow" className="transition-colors hover:text-ink">
            How it works
          </a>
          <a href="#testimony" className="transition-colors hover:text-ink">
            From the field
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="hidden h-9 items-center rounded-[6px] px-3 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex h-9 items-center rounded-[6px] bg-ink px-4 text-[13px] font-medium text-canvas transition-colors hover:bg-ink-hover"
          >
            Start a workspace
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ────────────────────────────────────────────────────────────────
   Hero
   ──────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <AmbientLight />
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-16 px-6 pb-24 pt-24 lg:grid-cols-[1.2fr_1fr] lg:pb-32 lg:pt-32">
        <div className="flex flex-col gap-8 fade-in-up">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-rule bg-surface px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted">
            <LiveDot />
            {BRAND.name} · creative voice for business
          </span>
          <h1 className="font-serif text-[56px] leading-[1.02] tracking-[-0.035em] text-ink sm:text-[68px] md:text-[84px]">
            Give your business
            <br />
            <span className="italic text-ink-muted">
              a voice worth hearing.
            </span>
          </h1>
          <p className="max-w-xl text-[17px] leading-[1.65] text-ink-muted">
            {BRAND.shortDescription}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/sign-up"
              className="group inline-flex h-11 items-center gap-2 rounded-[6px] bg-ink px-5 text-[14px] font-medium text-canvas transition-colors hover:bg-ink-hover"
            >
              Start a workspace
              <ArrowRight />
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex h-11 items-center rounded-[6px] border border-rule bg-surface px-5 text-[14px] font-medium text-ink transition-colors hover:border-rule-strong"
            >
              Sign in
            </Link>
          </div>
          <dl className="mt-6 grid grid-cols-3 gap-6 border-t border-rule pt-8">
            <Headline k="Transcribed" v="Every call" />
            <Headline k="Handoff" v="One step" />
            <Headline k="Review" v="Every turn" />
          </dl>
        </div>

        <aside className="lg:pl-6">
          <AgentPreviewCard />
        </aside>
      </div>
    </section>
  );
}

function Headline({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-subtle">
        {k}
      </dt>
      <dd className="mt-1 font-serif text-[22px] leading-[1.1] tracking-[-0.02em] text-ink">
        {v}
      </dd>
    </div>
  );
}

function AgentPreviewCard() {
  return (
    <div className="rounded-[12px] border border-rule bg-surface p-7 fade-in-up [animation-delay:120ms]">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-subtle">
          Agent · Front desk
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-surface-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-ink-muted">
          <LiveDot />
          On the line
        </span>
      </div>
      <h3 className="mt-4 font-serif text-[24px] leading-[1.15] tracking-[-0.02em] text-ink">
        Good evening. How can I help today?
      </h3>
      <div className="mt-5 space-y-2.5">
        <CallerBubble
          role="caller"
          text="Hi, I need to reschedule my appointment for next Thursday."
        />
        <CallerBubble
          role="agent"
          text="Of course. I can see your booking for Thursday at 3 PM. Would 4 PM on the same day work, or should I pull up Friday?"
        />
        <CallerBubble role="caller" text="Friday morning if you have it." />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 border-t border-rule pt-5">
        <MiniStat k="Handle time" v="1m 42s" />
        <MiniStat k="CSAT" v="4.6" />
        <MiniStat k="Resolved" v="92%" />
        <MiniStat k="Handed off" v="8%" />
      </div>
    </div>
  );
}

function CallerBubble({
  role,
  text,
}: {
  role: "caller" | "agent";
  text: string;
}) {
  const isAgent = role === "agent";
  return (
    <div
      className={`flex items-start gap-2.5 ${isAgent ? "" : "flex-row-reverse"}`}
    >
      <span
        className={`mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-[4px] border border-rule text-[9px] font-medium uppercase tracking-[0.06em] ${
          isAgent
            ? "bg-surface text-ink"
            : "bg-surface-muted text-ink-muted"
        }`}
      >
        {isAgent ? "AG" : "YOU"}
      </span>
      <p
        className={`max-w-[88%] rounded-[8px] border border-rule px-3 py-2 text-[12px] leading-[1.55] ${
          isAgent
            ? "bg-surface-muted/60 text-ink"
            : "bg-surface text-ink-muted"
        }`}
      >
        {text}
      </p>
    </div>
  );
}

function MiniStat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-[8px] border border-rule bg-surface-muted/40 px-3 py-2.5">
      <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-subtle">
        {k}
      </div>
      <div className="mt-0.5 font-serif text-[18px] tracking-[-0.01em] text-ink tabular-nums">
        {v}
      </div>
    </div>
  );
}

function LiveDot() {
  return (
    <span className="relative inline-flex size-1.5 items-center justify-center">
      <span className="absolute size-1.5 rounded-full bg-accent" />
      <span className="absolute size-3 animate-ping rounded-full bg-accent/30" />
    </span>
  );
}

function AmbientLight() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-[540px]"
      style={{
        background:
          "radial-gradient(ellipse 70% 55% at 50% 0%, rgba(220, 200, 160, 0.07), transparent 70%)",
      }}
    />
  );
}

/* ────────────────────────────────────────────────────────────────
   Capabilities (bento grid)
   ──────────────────────────────────────────────────────────────── */

function Capabilities() {
  const items = [
    {
      n: "01",
      title: "Design an agent in an afternoon.",
      body: "Write the goal, voice, and guardrails in plain language. Preview the call before you go live.",
      icon: <IconPen />,
    },
    {
      n: "02",
      title: "Your knowledge, in every call.",
      body: "Feed your agents the playbooks, policies, and product details they need to answer questions accurately — no training runs required.",
      icon: <IconBook />,
    },
    {
      n: "03",
      title: "Review every call like it's your own.",
      body: "Searchable transcripts, turn-by-turn flags, and coaching notes. Every exception lands in a queue your team already uses.",
      icon: <IconTranscript />,
    },
    {
      n: "04",
      title: "Metrics that move operations.",
      body: "Handle time, containment, CSAT, first-call resolution. The numbers your ops leads already track, now with a voice to them.",
      icon: <IconGauge />,
    },
  ];
  return (
    <section
      id="capabilities"
      className="border-t border-rule bg-surface-muted/40 py-24 sm:py-32"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[1fr_2fr]">
          <div className="scroll-reveal">
            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-subtle">
              What your team ships
            </span>
            <h2 className="mt-3 font-serif text-[40px] leading-[1.05] tracking-[-0.025em] text-ink">
              Four surfaces,
              <br />
              one calm product.
            </h2>
            <p className="mt-5 max-w-sm text-[14px] leading-[1.65] text-ink-muted">
              The platform is deliberately small. Every surface exists because
              someone on an operations team will touch it every day.
            </p>
          </div>
          <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-[12px] border border-rule bg-rule sm:grid-cols-2">
            {items.map((it, i) => (
              <li
                key={it.n}
                className="scroll-reveal bg-surface p-8"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-center justify-between">
                  <span className="flex size-8 items-center justify-center rounded-[6px] border border-rule bg-surface-muted/50 text-ink">
                    {it.icon}
                  </span>
                  <span className="font-mono text-[11px] tracking-[0.1em] text-ink-subtle">
                    {it.n}
                  </span>
                </div>
                <h3 className="mt-6 font-serif text-[22px] leading-[1.15] tracking-[-0.015em] text-ink">
                  {it.title}
                </h3>
                <p className="mt-2.5 text-[13px] leading-[1.65] text-ink-muted">
                  {it.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────
   Workflow
   ──────────────────────────────────────────────────────────────── */

function Workflow() {
  const steps = [
    {
      label: "Draft",
      title: "Write the agent's voice",
      body: "Describe the job it needs to do, the tone it should hold, and the things it must never say.",
    },
    {
      label: "Ground",
      title: "Attach your knowledge",
      body: "Upload policies, SKUs, FAQs, or your existing help center. The agent answers from your sources, not guesses.",
    },
    {
      label: "Publish",
      title: "Put it on a real number",
      body: "Route a phone number to the agent. It answers in seconds, 24/7, in the voice you drafted.",
    },
    {
      label: "Listen",
      title: "Review and iterate",
      body: "Every call is transcribed, flagged, and searchable. Coach the agent the same way you'd coach a teammate.",
    },
  ];
  return (
    <section id="workflow" className="py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-end scroll-reveal">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-subtle">
              How it works
            </span>
            <h2 className="mt-3 max-w-xl font-serif text-[40px] leading-[1.05] tracking-[-0.025em] text-ink">
              From first draft
              <br />
              to a phone line that answers.
            </h2>
          </div>
          <p className="max-w-sm text-[14px] leading-[1.65] text-ink-muted">
            No config files, no weeks of model tuning. A short, legible path
            from an idea on a whiteboard to a live phone number your customers
            can call.
          </p>
        </div>

        <ol className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <li
              key={step.label}
              className="scroll-reveal flex flex-col gap-4 rounded-[12px] border border-rule bg-surface p-7"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] tracking-[0.1em] text-ink-subtle">
                  STEP {String(i + 1).padStart(2, "0")}
                </span>
                <span className="rounded-full border border-rule bg-surface-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-ink-muted">
                  {step.label}
                </span>
              </div>
              <h3 className="font-serif text-[20px] leading-[1.2] tracking-[-0.015em] text-ink">
                {step.title}
              </h3>
              <p className="text-[13px] leading-[1.65] text-ink-muted">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────
   Editorial pull quote
   ──────────────────────────────────────────────────────────────── */

function Testimony() {
  return (
    <section
      id="testimony"
      className="border-y border-rule bg-surface-muted/40 py-24"
    >
      <div className="mx-auto max-w-4xl px-6 text-center scroll-reveal">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-subtle">
          From the field
        </span>
        <blockquote className="mt-6 font-serif text-[30px] italic leading-[1.22] tracking-[-0.02em] text-ink sm:text-[36px]">
          &ldquo;We replaced a three-person overnight queue with a single
          agent. The saving wasn&apos;t the headline — the headline was that
          our customers stopped waiting on hold at 2 AM.&rdquo;
        </blockquote>
        <div className="mt-6 flex items-center justify-center gap-3 text-[12px] text-ink-muted">
          <span className="font-medium text-ink">Priya Bhattacharya</span>
          <span className="text-ink-subtle">·</span>
          <span>Head of Support Operations, Wayfield Logistics</span>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────
   Closing CTA
   ──────────────────────────────────────────────────────────────── */

function ClosingCTA() {
  return (
    <section className="py-24 sm:py-32">
      <div className="mx-auto max-w-4xl px-6 text-center scroll-reveal">
        <h2 className="font-serif text-[44px] leading-[1.05] tracking-[-0.03em] text-ink sm:text-[56px]">
          Start with one agent.
          <br />
          <span className="italic text-ink-muted">Answer the next call.</span>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-[15px] leading-[1.65] text-ink-muted">
          Create a workspace in under a minute. Your first agent is free to
          draft, preview, and share with your team.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/sign-up"
            className="inline-flex h-11 items-center gap-2 rounded-[6px] bg-ink px-6 text-[14px] font-medium text-canvas transition-colors hover:bg-ink-hover"
          >
            Create a workspace
            <ArrowRight />
          </Link>
          <Link
            href="/sign-in"
            className="inline-flex h-11 items-center rounded-[6px] border border-rule bg-surface px-5 text-[14px] font-medium text-ink transition-colors hover:border-rule-strong"
          >
            I already have one
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────
   Footer
   ──────────────────────────────────────────────────────────────── */

function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-rule bg-canvas">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-12 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 text-[13px] text-ink-muted">
          <Wordmark href="" />
          <span>&middot;</span>
          <span>{BRAND.tagline}</span>
        </div>
        <div className="flex items-center gap-6 text-[12px] text-ink-subtle">
          <span>&copy; {year} {BRAND.name}. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}

/* ────────────────────────────────────────────────────────────────
   Icons (inline, no dependencies)
   ──────────────────────────────────────────────────────────────── */

function ArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M2 7H12M12 7L7.5 2.5M12 7L7.5 11.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPen() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M11 2.5L13.5 5L5 13.5H2.5V11L11 2.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M9.5 4L12 6.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function IconBook() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2.5 3H6.5C7.3 3 8 3.7 8 4.5V13.5C8 12.7 7.3 12 6.5 12H2.5V3Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M13.5 3H9.5C8.7 3 8 3.7 8 4.5V13.5C8 12.7 8.7 12 9.5 12H13.5V3Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTranscript() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect
        x="2.5"
        y="2.5"
        width="11"
        height="11"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M5 6H11M5 8H11M5 10H8.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconGauge() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2.5 11A5.5 5.5 0 0 1 13.5 11"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M8 11L10.5 6.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <circle cx="8" cy="11" r="1" fill="currentColor" />
    </svg>
  );
}

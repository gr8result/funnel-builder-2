import Link from "next/link";
import { useRouter } from "next/router";
import { BriefcaseBusiness, LineChart, Target } from "lucide-react";

/**
 * Shared frame for the three Freedom pages.
 *
 * The colour system is defined here once and used everywhere:
 *   green  - BUY, active, performing correctly
 *   blue   - waiting for entry
 *   amber  - watch or review
 *   red    - avoid, invalidated or exit
 *   grey   - unavailable data
 */

export const FREEDOM_PAGES = [
  { label: "Today's Opportunities", href: "/freedom", Icon: Target },
  { label: "My Trades", href: "/freedom/my-trades", Icon: LineChart },
  { label: "Long-Term Portfolio", href: "/freedom/long-term", Icon: BriefcaseBusiness },
];

export function formatMoney(value, currency = "USD") {
  if (!Number.isFinite(Number(value))) return "--";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value));
  } catch {
    return Number(value).toFixed(2);
  }
}

export function formatSignedMoney(value, currency = "USD") {
  if (!Number.isFinite(Number(value))) return "--";
  const sign = Number(value) > 0 ? "+" : "";
  return sign + formatMoney(value, currency);
}

export function formatPercent(value) {
  if (!Number.isFinite(Number(value))) return "--";
  const sign = Number(value) > 0 ? "+" : "";
  return sign + Number(value).toFixed(2) + "%";
}

export function formatTimestamp(value) {
  if (!value) return "No timestamp";
  const parsed = Date.parse(String(value).length <= 10 ? value + "T00:00:00Z" : value);
  if (!Number.isFinite(parsed)) return String(value);
  return new Date(parsed).toLocaleString("en-AU", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/** Large, unmistakable action badge. */
export function ActionBadge({ action, size = "large" }) {
  const tone = {
    BUY: "green", WAIT: "blue", WATCH: "amber", AVOID: "red", UNAVAILABLE: "grey",
  }[action] || "grey";
  const label = action === "UNAVAILABLE" ? "NO DATA" : action;
  return <span className={"fdBadge fdTone-" + tone + " fdBadge-" + size}>{label}</span>;
}

/** Collapsible container for the technical detail kept off the main pages. */
export function WhyThisResult({ children, label = "Why this result?" }) {
  return (
    <details className="fdWhy">
      <summary>{label}</summary>
      <div className="fdWhyBody">{children}</div>
    </details>
  );
}

/** Full-width banner used for market-data failure and no-result states. */
export function FreedomNotice({ tone = "grey", title, message, children }) {
  return (
    <section className={"fdNotice fdTone-" + tone} role="status">
      <h2>{title}</h2>
      {message ? <p>{message}</p> : null}
      {children}
    </section>
  );
}

export default function FreedomShell({ title, subtitle, actions = null, children }) {
  const router = useRouter();
  return (
    <div className="fdShell">
      <nav className="fdNav" aria-label="Freedom navigation">
        {FREEDOM_PAGES.map((page) => {
          const active = router.pathname === page.href;
          const Icon = page.Icon;
          return (
            <Link key={page.href} href={page.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
              <Icon aria-hidden="true" size={18} strokeWidth={2.5} />
              <span>{page.label}</span>
            </Link>
          );
        })}
      </nav>

      <header className="fdHeader">
        <div>
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {actions ? <div className="fdHeaderActions">{actions}</div> : null}
      </header>

      <main>{children}</main>

      <style jsx global>{`
        :root {
          --fd-green: #18a058;
          --fd-green-soft: rgba(24, 160, 88, 0.14);
          --fd-blue: #2b6ce0;
          --fd-blue-soft: rgba(43, 108, 224, 0.14);
          --fd-amber: #d08700;
          --fd-amber-soft: rgba(208, 135, 0, 0.16);
          --fd-red: #d93a3a;
          --fd-red-soft: rgba(217, 58, 58, 0.14);
          --fd-grey: #7b878f;
          --fd-grey-soft: rgba(123, 135, 143, 0.16);
          --fd-ink: #e8eef2;
          --fd-ink-dim: #a5b3bc;
          --fd-panel: #101a20;
          --fd-panel-2: #16232b;
          --fd-line: rgba(180, 200, 210, 0.18);
        }
        body {
          background: #070d11;
        }
        .fdShell {
          color: var(--fd-ink);
          margin: 0 auto;
          max-width: 1820px;
          padding: 20px 22px 64px;
        }

        /* Navigation ------------------------------------------------------- */
        .fdNav {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 26px;
        }
        .fdNav a {
          align-items: center;
          background: var(--fd-panel);
          border: 1px solid var(--fd-line);
          border-radius: 10px;
          color: var(--fd-ink-dim);
          display: inline-flex;
          font-size: 16px;
          font-weight: 800;
          gap: 10px;
          min-height: 52px;
          padding: 0 22px;
          text-decoration: none;
          transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
        }
        .fdNav a:hover {
          background: var(--fd-panel-2);
          color: var(--fd-ink);
        }
        .fdNav a.active {
          background: var(--fd-blue);
          border-color: #6aa4ff;
          color: #fff;
        }
        .fdNav a:focus-visible {
          box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.25);
          outline: none;
        }

        /* Header ----------------------------------------------------------- */
        .fdHeader {
          align-items: flex-end;
          border-bottom: 2px solid var(--fd-line);
          display: flex;
          flex-wrap: wrap;
          gap: 18px;
          justify-content: space-between;
          margin-bottom: 26px;
          padding-bottom: 18px;
        }
        .fdHeader h1 {
          font-size: 42px;
          font-weight: 900;
          letter-spacing: -0.8px;
          line-height: 1.05;
          margin: 0;
        }
        .fdHeader p {
          color: var(--fd-ink-dim);
          font-size: 17px;
          margin: 8px 0 0;
        }
        .fdHeaderActions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        /* Buttons ---------------------------------------------------------- */
        .fdButton {
          background: var(--fd-blue);
          border: 1px solid #6aa4ff;
          border-radius: 10px;
          color: #fff;
          cursor: pointer;
          font-size: 16px;
          font-weight: 800;
          min-height: 52px;
          padding: 0 26px;
        }
        .fdButton:hover:not(:disabled) { filter: brightness(1.12); }
        .fdButton:disabled { cursor: not-allowed; opacity: 0.55; }
        .fdButton.secondary {
          background: var(--fd-panel);
          border-color: var(--fd-line);
          color: var(--fd-ink);
        }
        .fdButton.danger {
          background: transparent;
          border-color: rgba(217, 58, 58, 0.5);
          color: #ff9d9d;
          font-size: 14px;
          min-height: 40px;
          padding: 0 16px;
        }

        /* Colour tones ----------------------------------------------------- */
        .fdTone-green { --tone: var(--fd-green); --tone-soft: var(--fd-green-soft); }
        .fdTone-blue { --tone: var(--fd-blue); --tone-soft: var(--fd-blue-soft); }
        .fdTone-amber { --tone: var(--fd-amber); --tone-soft: var(--fd-amber-soft); }
        .fdTone-red { --tone: var(--fd-red); --tone-soft: var(--fd-red-soft); }
        .fdTone-grey { --tone: var(--fd-grey); --tone-soft: var(--fd-grey-soft); }

        /* Action badge ----------------------------------------------------- */
        .fdBadge {
          background: var(--tone);
          border-radius: 8px;
          color: #fff;
          display: inline-block;
          font-weight: 900;
          letter-spacing: 1px;
          text-align: center;
          white-space: nowrap;
        }
        .fdBadge-large { font-size: 30px; line-height: 1; padding: 14px 24px; }
        .fdBadge-small { font-size: 15px; line-height: 1; padding: 8px 14px; letter-spacing: 0.6px; }

        /* Notice ----------------------------------------------------------- */
        .fdNotice {
          background: var(--tone-soft);
          border: 2px solid var(--tone);
          border-radius: 14px;
          margin-bottom: 24px;
          padding: 26px 28px;
        }
        .fdNotice h2 {
          color: var(--tone);
          font-size: 30px;
          font-weight: 900;
          margin: 0;
        }
        .fdNotice p {
          color: var(--fd-ink);
          font-size: 17px;
          line-height: 1.5;
          margin: 10px 0 0;
          max-width: 90ch;
        }

        /* Why this result -------------------------------------------------- */
        .fdWhy {
          border-top: 1px solid var(--fd-line);
          margin-top: 16px;
          padding-top: 12px;
        }
        .fdWhy summary {
          color: var(--fd-ink-dim);
          cursor: pointer;
          font-size: 15px;
          font-weight: 800;
          list-style: revert;
          padding: 4px 0;
        }
        .fdWhy summary:hover { color: var(--fd-ink); }
        .fdWhyBody {
          color: var(--fd-ink-dim);
          font-size: 14px;
          line-height: 1.6;
          padding-top: 10px;
        }
        .fdWhyBody dl {
          display: grid;
          gap: 6px 18px;
          grid-template-columns: max-content 1fr;
          margin: 0 0 12px;
        }
        .fdWhyBody dt { color: var(--fd-ink-dim); }
        .fdWhyBody dd { color: var(--fd-ink); margin: 0; }
        .fdWhyBody ul { margin: 0; padding-left: 20px; }
        .fdWhyBody li { margin-bottom: 5px; }

        /* Forms ------------------------------------------------------------ */
        .fdForm {
          background: var(--fd-panel);
          border: 1px solid var(--fd-line);
          border-radius: 14px;
          margin-bottom: 26px;
          padding: 24px;
        }
        .fdForm h2 { font-size: 24px; font-weight: 900; margin: 0 0 6px; }
        .fdForm .fdFormHint { color: var(--fd-ink-dim); font-size: 15px; margin: 0 0 18px; }
        .fdFormGrid {
          display: grid;
          gap: 14px;
          grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
        }
        .fdField { display: flex; flex-direction: column; gap: 6px; }
        .fdField label { font-size: 14px; font-weight: 800; }
        .fdField input, .fdField select, .fdField textarea {
          background: #0a1216;
          border: 1px solid var(--fd-line);
          border-radius: 8px;
          color: var(--fd-ink);
          font-size: 16px;
          min-height: 48px;
          padding: 10px 12px;
          width: 100%;
        }
        .fdField textarea { min-height: 80px; resize: vertical; }
        .fdField input:focus, .fdField select:focus, .fdField textarea:focus {
          border-color: var(--fd-blue);
          outline: none;
        }
        .fdFormActions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
        .fdErrors {
          background: var(--fd-red-soft);
          border: 1px solid var(--fd-red);
          border-radius: 10px;
          margin-top: 16px;
          padding: 14px 18px;
        }
        .fdErrors ul { margin: 0; padding-left: 20px; }
        .fdErrors li { color: #ffc4c4; font-size: 15px; margin-bottom: 4px; }

        @media (max-width: 900px) {
          .fdShell { padding: 16px 14px 48px; }
          .fdHeader h1 { font-size: 32px; }
          .fdBadge-large { font-size: 24px; padding: 11px 18px; }
        }
      `}</style>
    </div>
  );
}

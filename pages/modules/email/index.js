// /pages/modules/email/index.js
import Head from "next/head";
import Link from "next/link";
import { useState, useEffect } from "react";
import { supabase } from "../../../utils/supabase-client";

export default function EmailMarketingHub() {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAccount();
  }, []);

  async function loadAccount() {
    try {
      const { data: session } = await supabase.auth.getSession();
      const user = session?.session?.user;
      if (!user) return;

      const { data } = await supabase
        .from("accounts")
        .select("email_plan, email_plan_price")
        .eq("user_id", user.id)
        .single();

      setAccount(data);
    } catch (err) {
      console.error("Error loading account:", err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Email Marketing — Dashboard</title>
      </Head>

      <main className="wrap">
        <div className="container">
          {/* ---------- Banner ---------- */}
          <div className="banner">
            <div className="banner-left">
              <div className="banner-icon" aria-hidden>
                <Icon name="mail" size={48} />
              </div>
              <div className="banner-text">
                <h1 className="banner-title">Email Marketing</h1>
                <p className="banner-desc">Broadcasts, autoresponders, lists.</p>
              </div>
            </div>

            <Link href="/dashboard">
              <button className="back-btn" type="button">
                ← Back
              </button>
            </Link>
          </div>

          {/* ---------- Current Plan Banner ---------- */}
          <div className="plan-banner">
            {loading ? (
              <p>Loading plan details...</p>
            ) : account?.email_plan ? (
              <div className="plan-inner">
                <div>
                  <h2 className="plan-title">Current Email Plan</h2>
                  <p className="plan-desc">
                    <strong>{account.email_plan}</strong>{" "}
                    {account.email_plan_price
                      ? `— $${account.email_plan_price}/month`
                      : "(Custom Plan)"}
                  </p>
                </div>
                <Link href="/modules/billing/email-plans">
                  <button className="upgrade-btn" type="button">
                    Upgrade Plan
                  </button>
                </Link>
              </div>
            ) : (
              <div className="plan-inner">
                <div>
                  <h2 className="plan-title">No Email Plan Selected</h2>
                  <p className="plan-desc">
                    Choose a plan to begin sending campaigns.
                  </p>
                </div>
                <Link href="/modules/billing/email-plans">
                  <button className="upgrade-btn" type="button">
                    Select Plan
                  </button>
                </Link>
              </div>
            )}
          </div>

          {/* ---------- Cards ---------- */}
          <section className="block">
            <div className="grid">
              <Card
                colour="#f59e0b"
                icon="📧"
                title="Broadcasts"
                blurb="Send one-off emails to your lists."
                actions={[
                  { href: "/modules/email/broadcast", label: "Create New" },
                  { href: "/modules/email/broadcast/view",
                    label: "Open Past Broadcasts",
                  },
                ]}
              />
              <Card
                colour="#a855f7"
                icon="⏱️"
                title="Autoresponders"
                blurb="Timed sequences and follow-ups."
                actions={[
                  { href: "/modules/email/autoresponders/open", label: "Open" },
                  { href: "/modules/email/autoresponders", label: "Create" },
                ]}
              />
              <Card
                colour="#14b8a6"
                icon="📣"
                title="campaigns"
                blurb="Manage all your active and scheduled campaigns."
                actions={[
                  { href: "/modules/email/campaigns/new", label: "New campaigns" },
                  { href: "/modules/email/campaigns", label: "Open Existing" },

                ]}
              />

            </div>

            <div className="grid">
              <Card
                colour="#06b6d4"
                icon="👥"
                title="Lists"
                blurb="Audiences, segments & growth."
                actions={[{ href: "/modules/email/lists", label: "Open Create, Edit" }]}
              />
              <Card
                colour="#3b82f6"
                icon="🖼️"
                title="Templates"
                blurb="Design library for campaigns."
                actions={[
                  {
                    href: "/modules/email/templates/select",
                    label: "Open  Create   Import",
                  },
                ]}
              />
              <Card
                colour="#f97316"
                icon="⚙️"
                title="Automation"
                blurb="Workflows, triggers and actions."
                actions={[
                  { href: "/modules/email/automation", label: "Open" },
                  { href: "/modules/email/automation/new", label: "Create" },
                ]}
              />
            </div>

            <div className="grid">


              <Card
                colour="#ec4899"
                icon="📊"
                title="CRM"
                blurb="Contacts, tags and activity."
                actions={[{ href: "/modules/email/crm", label: "Open" }]}
              />
              <Card
                colour="#10b981"
                icon="📈"
                title="Reports & Analytics"
                blurb="Track opens, clicks and conversions."
                actions={[{ href: "/modules/email/reports", label: "Open" }]}
              />




            </div>
          </section>
        </div>
      </main>

      {/* ---------- Styles ---------- */}
      <style jsx>{`
        .wrap {
          min-height: 100vh;
          background: #0c121a;
          color: #fff;
          padding: 24px 12px 36px;
        }
        .container {
          max-width: 1320px;
          margin: 0 auto;
        }

        .banner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #facc15;
          padding: 18px 22px;
          border-radius: 14px;
          margin: 0 auto 20px;
          border: 2px solid #eab308;
          color: #1a1f29;
        }

        .banner-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .banner-icon {
          width: 69px;
          height: 69px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: rgba(0, 0, 0, 0.14);
        }

        .banner-title {
          margin: 0;
          font-size: 48px;
          font-weight: 600;
          line-height: 1.05;
        }

        .banner-desc {
          margin: 4px 0 0 0;
          font-size: 18px;
          opacity: 0.95;
        }

        .back-btn {
          background: rgba(2, 6, 23, 0.75);
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 10px;
          padding: 8px 14px;
          font-size: 18px;
          font-weight: 600;
          cursor: pointer;
        }

        .plan-banner {
          background: #1f2937;
          border: 1px solid #334155;
          border-radius: 12px;
          padding: 16px 20px;
          margin: 0 auto 26px;
        }

        .plan-inner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
        }

        .plan-title {
          margin: 0;
          font-size: 36px;
          font-weight: 600;
          color: #60a5fa;
        }

        .plan-desc {
          margin: 4px 0 0 0;
          font-size: 18px;
          opacity: 0.9;
        }

        .upgrade-btn {
          background: #3b82f6;
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 8px 16px;
          font-weight: 600;
          cursor: pointer;
          font-size: 18px;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          margin-bottom: 12px;
        }

        @media (min-width: 980px) {
          .grid {
            grid-template-columns: 1fr 1fr 1fr;
            gap: 12px;
          }
        }
      `}</style>
    </>
  );
}

/* ---------- Card ---------- */
function Card({ colour, icon, title, blurb, actions = [] }) {
  return (
    <article className="card">
      <div className="icon">{icon}</div>
      <div className="body">
        <h3 className="heading">{title}</h3>
        <p className="blurb">{blurb}</p>
        <div className="actions">
          {actions.map((a) => (
            <Link key={a.href + a.label} href={a.href} className="btn">
              {a.label}
            </Link>
          ))}
        </div>
      </div>

      <style jsx>{`
        .card {
          display: flex;
          align-items: center;
          gap: 14px;
          border-radius: 18px;
          background: #1a1f29;
          border: 2px solid ${colour};
          transition: all 0.25s ease;
          padding: 14px;
          color: #fff;
          min-height: 92px;
        }
        .card:hover {
          background: ${colour};
          color: #fff;
        }
        .icon {
          font-size: 48px;
        }
        .heading {
          margin: 0 0 2px;
          font-weight: 700;
          font-size: 22px;
        }
        .blurb {
          margin: 0 0 8px;
          opacity: 0.95;
          font-size: 18px;
        }
        .actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 28px;
          line-height: 28px;
          padding: 0 8px;
          border-radius: 9px;
          background: rgba(0, 0, 0, 0.18);
          color: #fff;
          text-decoration: none;
          border: 2px solid rgba(255, 255, 255, 0.22);
          font-weight: 600;
          font-size: 18px;
        }
        .card:hover .btn {
          background: rgba(0, 0, 0, 0.25);
          border-color: #fff;
        }
      `}</style>
    </article>
  );
}

/* ---------- Icon ---------- */
function Icon({ name, size = 48 }) {
  const stroke = "#111827"; // dark stroke reads better on yellow
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  switch (name) {
    case "mail":
      return (
        <svg {...props}>
          <rect x="3" y="5" width="20" height="14" rx="2" />
          <polyline points="3 7 12 13 21 7" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}

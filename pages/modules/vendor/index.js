// /modules/vendor/index.js

import Link from "next/link";
import { useRouter } from "next/router";
import { Briefcase, ShoppingBag, BarChart3 } from "lucide-react";
import ICONS from "../../../components/iconMap";
import { useEffect, useState } from "react";
import { supabase } from "../../../utils/supabase-client";
import VendorUserBanner from "../../../components/vendor/VendorUserBanner";

const SPECIAL_VENDOR_CARDS = [
  {
    color: "#f97316",
    icon: ICONS.analytics, // bar chart
    href: "/modules/vendor/affiliates/manage-products/performance-reports",
    title: "Vendor's Product Sales & Affiliate Performance Reports",
    desc: "Track Affiliate Sales and Commission Payouts in Real Time.",
  },
  {
    color: "#10b981",
    icon: ICONS.assets, // folder icon
    href: "/modules/vendor/affiliates/manage-products",
    title: "Manage Your Products and Services, Sold by Your Affiliates",
    desc: "Manage your Affiliate Approvals, assets, links and deactivation.",
  },
  {
    color: "#c026d3",
    icon: ICONS.edit, // closest to "add/submit"
    href: "/modules/vendor/affiliates/manage-products/submit",
    title: "Submit a New Product or Service to be sold by Affiliates",
    desc: "Create a listing, set commission rates and add assets.",
  },
  {
    color: "#ef4444",
    icon: ICONS.documents,
    href: "/modules/vendor/affiliates/manage-products/upload-assets", 
    title: "Creative assets",
    desc: "Add your product banners, images, emails & swipe assets.",
  },
  {
    title: "Online Courses",
    desc: "Host and Sell Your Own Online Courses.",
    href: "/modules/vendor/courses",
    icon: ICONS.courses,
    color: "#ec4899",
  },
  {
    title: "Digital Products",
    desc: "Sell your own Digital Downloads.",
    href: "/modules/vendor/digital",
    icon: ICONS.digitalProducts,
    color: "#475569",
  },
  {
    title: "Physical Products",
    desc: "Manage Your Physical Store Products.",
    href: "/modules/vendor/physical",
    icon: ICONS.products,
    color: "#0ea5e9",
  },
];


export default function VendorDashboard() {
  const renderIcon = (IconComponent, size = 48) => {
    if (!IconComponent) return null;
    return <IconComponent size={size} />;
  };

  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(false);
      setAllowed(true);
    })();
  }, []);

  if (loading) {
    return <div style={{ color: '#fff', fontSize: 24, textAlign: 'center', marginTop: 80 }}>Loading...</div>;
  }
  if (!allowed) {
    // ...existing code...
  }

  return (
    <div className="wrap">
      {/* Banner */}
      <div
        className="vendor-banner"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#0df118',
          borderRadius: 16,
          padding: '24px 36px',
          marginBottom: 36,
          boxShadow: '0 4px 24px 0 rgba(13,241,24,0.08)',
          width: 1320,
          maxWidth: '100%',
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Vendor Icon hard left */}
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(16,26,44,0.10)', borderRadius: 12, padding: 8, marginRight: 18 }}>
            <Briefcase size={48} color="#ffffff" />
          </span>
          <div>
            <div style={{ fontSize: 48, fontWeight: 600, color: '#0840d8', lineHeight: 1 }}>
              Vendor Dashboard
            </div>
            <div style={{ fontSize: 18, color: '#0840d8', fontWeight: 400, marginTop: 6 }}>
              Offer your own products for sale and have them promoted and sold by Affiliates.
            </div>
          </div>
        </div>
        {/* Back Button */}
        <button
          type="button"
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: '#0840d8',
            background: 'rgba(16,26,44,0.10)',
            border: '2px solid #101a2c',
            borderRadius: 8,
            padding: '10px 28px',
            transition: 'background 0.2s, color 0.2s',
            textDecoration: 'none',
            marginLeft: 24,
            display: 'inline-block',
            cursor: 'pointer',
          }}
          onMouseOver={e => {
            e.currentTarget.style.background = '#101a2c';
            e.currentTarget.style.color = '#0df118';
          }}
          onMouseOut={e => {
            e.currentTarget.style.background = 'rgba(16,26,44,0.10)';
            e.currentTarget.style.color = '#101a2c';
          }}
          onClick={async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              router.push("/dashboard");
            } else {
              router.push("/marketplace");
            }
          }}
        >
          ← Back
        </button>
      </div>

      <VendorUserBanner />



      {/* Section Title: Manage Your Products */}
      <div style={{
        fontSize: 22,
        fontWeight: 700,
        color: '#fff',
        marginLeft: 'auto',
        marginRight: 'auto',
        maxWidth: 1320,
        width: '100%',
        marginBottom: 18,
        textAlign: 'left',
      }}>
        Manage Your Products
      </div>
      {/* Vendor Section 1: First two cards, 2 columns */}
      <section className="section">
        <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, width: '100%', maxWidth: 1320 }}>
          {SPECIAL_VENDOR_CARDS.slice(0, 2).map((card, i) => (
            <Link key={i} href={card.href}>
              <div
                className="card"
                style={{
                  borderColor: card.color,
                  ['--hover-color']: card.color, // ✅ FIXED
                }}
              >
                <span className="icon">
                  {renderIcon(card.icon, 48)}
                </span>
                <div>
                  <h3 className="card-title">{card.title}</h3>
                  <p>{card.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>


      {/* Page Divider splitting the page visually */}
      <div style={{
        width: '100%',
        borderTop: '3px solid #22c55e',
        margin: '48px 0 18px 0',
        opacity: 0.7,
        maxWidth: 1320,
        marginLeft: 'auto',
        marginRight: 'auto',
      }} />

      {/* Section Title: Add New Products */}
      <div style={{
        fontSize: 22,
        fontWeight: 700,
        color: '#fff',
        marginLeft: 'auto',
        marginRight: 'auto',
        maxWidth: 1320,
        width: '100%',
        marginBottom: 18,
        textAlign: 'left',
      }}>
        Add New Products
      </div>

      {/* Vendor Section 2: Remaining cards, 3 columns */}
      <section className="section">
        <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18, width: '100%', maxWidth: 1320 }}>
          {SPECIAL_VENDOR_CARDS.slice(2).map((card, i) => (
            <Link key={i+2} href={card.href}>
              <div
                className="card"
                style={{
                  borderColor: card.color,
                  ['--hover-color']: card.color, // ✅ FIXED
                }}
              >
                <span className="icon">
                  {renderIcon(card.icon, 48)}
                </span>
                <div>
                  <h3 className="card-title">{card.title}</h3>
                  <p>{card.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <style jsx>{`
        .wrap {
          min-height: 100vh;
          background: #0c121a;
          color: #ffffff;
          padding: 28px 22px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .banner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #0df118;
          padding: 20px 24px;
          border-radius: 12px;
          margin-bottom: 26px;
          width: 100%;
          max-width: 1320px;
        }

        .banner-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .banner-icon {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 50%;
          padding: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .banner-title {
          font-size: 48px;
          font-weight: 600;
          color: #452bdb;
          margin: 0;
        }

        .banner-desc {
          font-size: 18px;
          font-weight: 600;
          margin: 4px 0 0;
          color: #452bdb;
          opacity: 0.9;
        }

        .back-btn {
          font-size: 18px;
          font-weight: 600;
          background: #ffffff;
          color: #0d87f1;
          padding: 10px 18px;
          border-radius: 10px;
          border: none;
          cursor: pointer;
        }

        .section {
          width: 100%;
          max-width: 1320px;
          text-align: left;
        }

        .section-title {
          font-size: 32px;
          margin-bottom: 7px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .section-desc {
          font-size: 18px;
          opacity: 0.8;
        }

        .divider {
          border: none;
          border-top: 4px solid #78f60a;
          margin: 38px 0 30px;
          width: 100%;
          max-width: 1320px;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
          width: 100%;
          max-width: 1320px;
        }

        .card {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 18px;
          border: 2px solid;
          border-radius: 12px;
          background: #0c121a;
          transition: all 0.25s ease;
          cursor: pointer;
        }

        .card:hover {
          background: var(--hover-color);
          color: #000;
        }

        .card-title {
          font-size: 26px;
          font-weight: 500;
          margin: 0 0 6px;
        }

        .card p {
          margin: 0;
          opacity: 0.85;
        }
      `}</style>
    </div>
  );
}
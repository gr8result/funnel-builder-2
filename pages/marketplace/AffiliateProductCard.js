import Link from "next/link";
import { useState } from "react";
import { supabase } from "../../utils/supabase-client";

export default function AffiliateProductCard({ product, affiliateApproved, selected, onSelect, hasAffiliateApplication, userVerified, userEmailVerified, onShowEmailVerifyModal, user }) {
  const [expanded, setExpanded] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [applyError, setApplyError] = useState("");
  const maxLength = 120;
  const isLong = product.description && product.description.length > maxLength;
  return (
    <>
      <div
        className={`bg-[#1a233b] rounded-xl border ${selected ? 'border-green-400 ring-4 ring-green-400' : 'border-slate-700'} overflow-hidden flex flex-col min-h-[420px] transition-all duration-150`}
        style={{ cursor: affiliateApproved ? 'pointer' : 'not-allowed', opacity: affiliateApproved ? 1 : 0.7 }}
        onClick={affiliateApproved ? () => onSelect?.(product.id) : undefined}
        tabIndex={affiliateApproved ? 0 : -1}
        aria-disabled={!affiliateApproved}
      >
      <img
        src={product.image_url || "/placeholder.jpg"}
        alt={product.title}
        className="h-40 w-full object-cover"
      />
      <div className="p-4 flex flex-col flex-grow">
        <h3 className="font-semibold text-xl mb-2">{product.title}</h3>
        <p className="text-sm opacity-90 mb-2">
          {expanded || !isLong ? product.description : product.description?.slice(0, maxLength) + (isLong ? "..." : "")}
        </p>
        {isLong && (
          <button
            className="text-blue-400 underline text-xs mb-2 self-start"
            onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
          >
            {expanded ? "Read less" : "Read more"}
          </button>
        )}
        <div className="text-blue-300 font-semibold mb-2">
          Category: {product.category || "General"}
        </div>
        <div className="text-yellow-300 font-semibold mb-1">
          Gravity: {product.gravity || 0}
          {product.epc !== undefined && (
            <span className="ml-3">EPC: ${Number(product.epc).toFixed(2)}</span>
          )}
        </div>
        <div className="text-green-400 font-semibold mb-1">
          Commission: {product.commission_value}%
          {product.commission_type === "fixed" && <span> (Fixed)</span>}
        </div>
        <div className="text-blue-400 font-bold text-lg mb-1">
          {product.sale_price
            ? `$${Number(product.sale_price).toFixed(2)}`
            : "No Retail Price"}
        </div>
        <div className="text-green-400 font-semibold mb-2">
        Revenue per Sale: ${Number(product.affiliate_revenue_per_sale || 0).toFixed(2)}
        </div>
        <div className="text-xs text-yellow-400 mb-2" style={{wordBreak: 'break-all'}}>
          Product ID: {product.id}
        </div>
        <div className="mt-auto flex flex-col gap-2">
          {product.sales_page_url && (
            <a
              href={product.sales_page_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
            >
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded">
                Sales Page
              </button>
            </a>
          )}
          {hasAffiliateApplication ? (
            <div style={{
              background: '#facc15',
              color: '#222',
              fontWeight: 700,
              fontSize: 16,
              borderRadius: 10,
              padding: '12px 8px',
              textAlign: 'center',
              border: '2px solid #eab308',
            }}>
              You have already applied.<br />
              Please wait for vendor approval.
            </div>
          ) : (
            <button
              className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2 rounded font-bold"
              style={{
                opacity: affiliateApproved ? 1 : 0.55,
                cursor: affiliateApproved ? "pointer" : "not-allowed",
                border: selected ? '2px solid #22c55e' : undefined,
                background: selected ? '#22c55e' : undefined,
                color: selected ? '#222' : undefined
              }}
              tabIndex={affiliateApproved ? 0 : -1}
              aria-disabled={!affiliateApproved}
              onClick={async e => {
                e.stopPropagation();
                setApplyError("");
                if (!affiliateApproved) {
                  e.preventDefault();
                  return false;
                }
                // Approved affiliates only need email confirmed, not phone verified
                if (!userEmailVerified) {
                  e.preventDefault();
                  if (onShowEmailVerifyModal) onShowEmailVerifyModal();
                  return false;
                }
                if (!user) {
                  setApplyError("You must be logged in to apply.");
                  return;
                }
                // Use the actual product.id from affiliate_products
                const realProductId = product.id;

                const { error } = await supabase
                  .from("affiliate_product_applications")
                  .insert({
                    affiliate_user_id: user.id,
                    product_id: realProductId,
                    status: "pending"
                  });

                if (error) {
                  setApplyError(error.message);
                  return;
                }

                setShowConfirmation(true);
              }}
            >
              {selected ? 'Selected' : 'Apply'}
            </button>
          )}
          {applyError && (
            <div style={{
              background: '#ef4444',
              color: '#fff',
              fontWeight: 700,
              fontSize: 15,
              borderRadius: 10,
              padding: '12px 8px',
              textAlign: 'center',
              border: '2px solid #b91c1c',
              marginTop: 8
            }}>
              Error: {applyError}
            </div>
          )}
        </div>
      </div>
    </div>
    {/* Confirmation Modal with full application details */}
    {showConfirmation && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0,0,0,0.7)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          background: '#181f2e',
          color: '#fff',
          borderRadius: 16,
          padding: 40,
          minWidth: 600,
          maxWidth: 900,
          boxShadow: '0 8px 32px #000a',
          textAlign: 'left',
        }}>
          <h2 style={{ color: '#22c55e', fontSize: 32, marginBottom: 18 }}>Affiliate Application Submitted</h2>
          <table style={{ width: '100%', fontSize: 18, borderCollapse: 'collapse', marginBottom: 24 }}>
            <tbody>
              <tr><td style={{ fontWeight: 700, color: '#1de9b6', padding: '10px 18px', width: 220 }}>Status</td><td style={{ padding: '10px 18px' }}>Pending</td></tr>
              <tr><td style={{ fontWeight: 700, color: '#1de9b6', padding: '10px 18px', width: 220 }}>Applied At</td><td style={{ padding: '10px 18px' }}>{new Date().toLocaleString()}</td></tr>
              <tr><td style={{ fontWeight: 700, color: '#1de9b6', padding: '10px 18px', width: 220 }}>Affiliate User ID</td><td style={{ padding: '10px 18px' }}>{user?.id}</td></tr>
              <tr><td style={{ fontWeight: 700, color: '#1de9b6', padding: '10px 18px', width: 220 }}>Product ID</td><td style={{ padding: '10px 18px' }}>{product.id}</td></tr>
              <tr><td style={{ fontWeight: 700, color: '#1de9b6', padding: '10px 18px', width: 220 }}>Product Title</td><td style={{ padding: '10px 18px' }}>{product.title}</td></tr>
              <tr><td style={{ fontWeight: 700, color: '#1de9b6', padding: '10px 18px', width: 220 }}>Sale Price</td><td style={{ padding: '10px 18px' }}>${Number(product.sale_price || 0).toFixed(2)}</td></tr>
              <tr><td style={{ fontWeight: 700, color: '#1de9b6', padding: '10px 18px', width: 220 }}>Commission Type</td><td style={{ padding: '10px 18px' }}>{product.commission_type}</td></tr>
              <tr><td style={{ fontWeight: 700, color: '#1de9b6', padding: '10px 18px', width: 220 }}>Commission Value</td><td style={{ padding: '10px 18px' }}>{product.commission_value}%</td></tr>
              <tr><td style={{ fontWeight: 700, color: '#1de9b6', padding: '10px 18px', width: 220 }}>Revenue per Sale</td><td style={{ padding: '10px 18px' }}>${Number(product.affiliate_revenue_per_sale || 0).toFixed(2)}</td></tr>
              <tr><td style={{ fontWeight: 700, color: '#1de9b6', padding: '10px 18px', width: 220 }}>Image URL</td><td style={{ padding: '10px 18px' }}>{product.image_url}</td></tr>
            </tbody>
          </table>
          <div style={{ fontSize: 20, marginBottom: 24 }}>
            Your application has been submitted and the vendor will review it.<br />
            Check your affiliate dashboard for approvals.
          </div>
          <button
            style={{
              padding: '10px 32px',
              borderRadius: 8,
              background: '#22c55e',
              color: '#222',
              fontWeight: 700,
              fontSize: 18,
              border: 'none',
              cursor: 'pointer',
              marginTop: 10
            }}
            onClick={() => setShowConfirmation(false)}
          >
            Close
          </button>
        </div>
      </div>
    )}
    </>
  );
}
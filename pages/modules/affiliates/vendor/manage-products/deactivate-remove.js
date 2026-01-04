import Head from "next/head";
import Link from "next/link";
import ICONS from "../../../../../components/iconMap";

export default function DeactivateRemove() {
  return (
    <>
      <Head><title>Deactivate or Remove — Vendor</title></Head>
      <main className="wrap">
        <div className="banner" style={{ background: "#a855f7" }}>
          <div className="banner-left">
            <span className="banner-icon">{ICONS.trash({ size: 28 })}</span>
            <div>
              <h1 className="banner-title">Deactivate or Remove</h1>
              <p className="banner-desc">Pause or permanently remove your listings.</p>
            </div>
          </div>
          <Link href="/modules/affiliates/vendor/manage-products" className="back-btn">← Back</Link>
        </div>
      </main>
      <style jsx>{`
        .wrap { min-height: 100vh; background: #0c121a; color: #fff; padding: 28px 22px; display: flex; flex-direction: column; align-items: center; font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
        .banner { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; border-radius: 14px; width: 100%; max-width: 1320px; color: #fff; }
        .banner-left { display: flex; align-items: center; gap: 12px; }
        .banner-icon { background: rgba(255,255,255,0.15); border-radius: 50%; padding: 6px; display: flex; align-items: center; justify-content: center; }
        .banner-title { font-size: 20px; font-weight: 900; margin: 0; }
        .banner-desc { font-size: 14px; opacity: 0.9; margin: 0; }
        .back-btn { background: rgba(255,255,255,0.15); color: #fff; font-weight: 800; padding: 8px 14px; border-radius: 10px; text-decoration: none; border: 2px solid rgba(255,255,255,0.3); transition: all 0.2s ease; }
        .back-btn:hover { background: rgba(255,255,255,0.25); border-color: #fff; }
      `}</style>
    </>
  );
}

// pages/modules/email/step1.tsx
import { useState } from "react";

export default function EmailStep1() {
  const [headline, setHeadline] = useState("");
  const [content, setContent] = useState("");

  return (
    <div className="page">
      <main className="wrap">
        {/* Yellow band */}
        <section className="yellow">
          {/* White panel @ 90% of yellow */}
          <div className="white">
            <h1 className="title">Step 1 — Email Basics</h1>

            <label className="label" htmlFor="headline">Headline</label>
            <input
              id="headline"
              className="input"
              placeholder="Write your headline…"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
            />

            <label className="label" htmlFor="content">Main content</label>
            <textarea
              id="content"
              className="textarea"
              placeholder="Write your email content…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />

            <div className="actions">
              <button className="btn secondary" onClick={() => { setHeadline(""); setContent(""); }}>
                Clear
              </button>
              <button className="btn primary" onClick={() => alert("Saved Step 1")}>
                Save & Continue
              </button>
            </div>
          </div>
        </section>
      </main>

      <style jsx>{`
        /* ---- Tweak these if you want minor adjustments ---- */
        :root {
          --yellow-max-width: 1200px; /* Make the yellow band ‘wider’ */
          --yellow-padding-y: 48px;   /* Yellow top/bottom space */
          --white-min-height: 520px;  /* Make the white panel ‘tall’ */
          --white-width: 90%;         /* White panel width vs yellow */
          --base-font: 16px;
          --pt24: 32px;               /* 24pt ≈ 32px */
          --radius: 18px;
          --shadow: 0 10px 30px rgba(0,0,0,0.12);
          --yellow: #ffd84d;          /* Clean warm yellow */
          --border: #e9e9e9;
          --ink: #111;
          --muted: #666;
        }

        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          background: #fafafa;
          color: var(--ink);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }

        .wrap {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Yellow band centred with a wider feel */
        .yellow {
          background: var(--yellow);
          width: min(100%, var(--yellow-max-width));
          margin: 0 auto;
          border-radius: calc(var(--radius) + 6px);
          box-shadow: var(--shadow);
          padding: var(--yellow-padding-y) 0; /* vertical only to emphasise ‘band’ */
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* White panel is 90% of yellow width, centred, tall */
        .white {
          width: var(--white-width);
          background: #fff;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          min-height: var(--white-min-height);
          padding: 28px 28px 32px;
          box-shadow: var(--shadow);
          display: flex;
          flex-direction: column;
          gap: 18px;
          margin: 0 auto;
        }

        .title {
          margin: 0 0 8px 0;
          font-size: clamp(24px, 2.4vw, 34px);
          font-weight: 700;
          text-align: center;
          letter-spacing: 0.2px;
        }

        .label {
          font-size: 14px;
          color: var(--muted);
          margin-top: 8px;
        }

        /* Inputs at 24pt baseline */
        .input, .textarea {
          width: 100%;
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 14px 16px;
          font-size: var(--pt24);
          line-height: 1.2;
          outline: none;
          background: #fff;
        }
        .input:focus, .textarea:focus {
          border-color: #c9c9c9;
        }

        .textarea {
          min-height: 280px; /* tall typing area */
          resize: vertical;
        }

        .actions {
          margin-top: auto;
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .btn {
          border: 1px solid transparent;
          border-radius: 12px;
          padding: 12px 18px;
          font-size: 16px;
          cursor: pointer;
          transition: transform 0.04s ease, box-shadow 0.2s ease;
        }
        .btn:active { transform: translateY(1px); }

        .btn.primary {
          background: #111;
          color: #fff;
          box-shadow: 0 6px 18px rgba(0,0,0,0.15);
        }
        .btn.primary:hover { box-shadow: 0 10px 26px rgba(0,0,0,0.18); }

        .btn.secondary {
          background: #fff;
          color: #111;
          border-color: #cfcfcf;
        }

        /* Make sure everything stays centred on small screens too */
        @media (max-width: 640px) {
          :root {
            --white-min-height: 460px;
            --yellow-padding-y: 32px;
          }
          .white { padding: 22px; }
          .actions { justify-content: center; }
        }
      `}</style>
    </div>
  );
}





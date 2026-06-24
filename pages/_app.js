// /pages/_app.js
// FULL REPLACEMENT — removes GlobalDialer entirely (no floating dialer on every page)

import "../styles/globals.css";
import "../styles/elementor-icon-fonts.css";
// NOTE: @chaibuilder/sdk/styles and react-image-crop/dist/ReactCrop.css moved
// to the specific pages that use them, to avoid bloating the shared bundle.
import "../styles/sidenav.css";
import "../styles/marketplace-overhaul.css";
import Layout from "../components/Layout";
import { AuthProvider } from "../context/AuthContext";
import { WorkspaceProvider } from "../hooks/useWorkspace";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";

function isBenignDevRuntimeNoise(error) {
  if (process.env.NODE_ENV !== "development") return false;

  const message = String(error?.message || error || "");
  const stack = String(error?.stack || "");

  if (message.includes("Lock broken by another request with the 'steal' option")) {
    return true;
  }

  return message.includes("Cannot read properties of undefined (reading 'components')")
    && stack.includes("hot-reloader-pages");
}

function DevRuntimeNoiseGuard() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || typeof window === "undefined") return undefined;

    const stopOverlay = (event) => {
      const error = event?.reason || event?.error;
      if (!isBenignDevRuntimeNoise(error)) return;
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
    };

    window.addEventListener("error", stopOverlay, true);
    window.addEventListener("unhandledrejection", stopOverlay, true);

    return () => {
      window.removeEventListener("error", stopOverlay, true);
      window.removeEventListener("unhandledrejection", stopOverlay, true);
    };
  }, []);

  return null;
}

// ── Full-screen loading overlay shown during route transitions ────────────────
function RouteProgressBar() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show = () => setVisible(true);
    const hide = () => setVisible(false);
    router.events.on("routeChangeStart", show);
    router.events.on("routeChangeComplete", hide);
    router.events.on("routeChangeError", hide);
    return () => {
      router.events.off("routeChangeStart", show);
      router.events.off("routeChangeComplete", hide);
      router.events.off("routeChangeError", hide);
    };
  }, [router]);

  if (!visible) return null;

  const r = 38;
  const circ = 2 * Math.PI * r;
  const arcLen = circ * 0.72;

  return (
    <>
      <style>{`
        @keyframes rb-spin{to{transform:rotate(360deg)}}
        @keyframes rb-pulse{0%,100%{opacity:.18;transform:scale(.8);}50%{opacity:.6;transform:scale(1.1);}}
        @keyframes rb-dot{0%,100%{opacity:.2;}50%{opacity:1;}}
      `}</style>
      <div style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: "rgba(5,7,15,0.82)",
        backdropFilter: "blur(4px)",
        display: "grid", placeItems: "center",
        pointerEvents: "none",
      }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
          {/* Ring + glow orb */}
          <div style={{ position: "relative", width: 108, height: 108, display: "grid", placeItems: "center" }}>
            {/* Pulsing glow */}
            <div style={{
              position: "absolute", width: 76, height: 76, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(14,165,233,.28) 0%, transparent 72%)",
              animation: "rb-pulse 2.6s ease-in-out infinite",
            }} />
            {/* Spinning arc */}
            <svg width="108" height="108" viewBox="0 0 108 108"
              style={{ position: "absolute", animation: "rb-spin 1.8s linear infinite" }}>
              <defs>
                <linearGradient id="rb-arc-g" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#0ea5e9" />
                  <stop offset="60%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                </linearGradient>
              </defs>
              <circle cx="54" cy="54" r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="4.5" />
              <circle cx="54" cy="54" r={r} fill="none" stroke="url(#rb-arc-g)" strokeWidth="4.5"
                strokeLinecap="round"
                strokeDasharray={`${arcLen.toFixed(1)} ${(circ - arcLen).toFixed(1)}`}
                transform="rotate(-90 54 54)"
              />
              <circle cx={54 + r} cy="54" r="4" fill="#0ea5e9"
                style={{ filter: "drop-shadow(0 0 6px #0ea5e9)" }} />
            </svg>
            {/* Centre jewel */}
            <div style={{
              position: "relative", width: 14, height: 14, borderRadius: "50%",
              background: "linear-gradient(135deg,#0ea5e9,#8b5cf6)",
              boxShadow: "0 0 20px rgba(14,165,233,.8), 0 0 6px rgba(14,165,233,.5)",
            }} />
          </div>

          {/* Breathing dots */}
          <div style={{ display: "flex", gap: 7 }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{
                display: "block", width: 6, height: 6, borderRadius: "50%",
                background: "#0ea5e9",
                animation: `rb-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default function MyApp({ Component, pageProps }) {
  const router = useRouter();
  const actualPath = String(router.asPath || "").split("?")[0];
  const isErrorRoute = router.pathname === "/404" || router.pathname === "/500" || router.pathname === "/_error";

  const noLayoutRoutes = [
    "/account",
    "/create-account",
    "/login",
    "/signup",
    "/verify-email",
    "/legal/vendor-agreement",
    "/reset-password",
    "/u/",
    "/p/",
    "/sites",
    "/404",
    "/500",
    "/_error",
    "/modules/website-builder/preview",
    "/modules/website-builder/project",
  ];
  const hideLayout = Boolean(Component.disableLayout)
    || isErrorRoute
    || noLayoutRoutes.some((path) =>
      router.pathname.startsWith(path) || actualPath.startsWith(path)
    );

  const Root = ({ children }) => (
    <div style={{ fontSize: 16, lineHeight: 1.4 }}>
      <style jsx global>{`
        html,
        body {
          font-size: 16px;
        }
        button,
        input,
        select,
        textarea {
          font-size: 16px;
        }
      `}</style>
      {children}
    </div>
  );

  if (hideLayout) {
    return (
      <AuthProvider>
        <WorkspaceProvider>
          <DevRuntimeNoiseGuard />
          <RouteProgressBar />
          <Root>
            <Component {...pageProps} />
          </Root>
        </WorkspaceProvider>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <WorkspaceProvider>
        <DevRuntimeNoiseGuard />
        <RouteProgressBar />
        <Root>
          <Layout>
            <Component {...pageProps} />
          </Layout>
        </Root>
      </WorkspaceProvider>
    </AuthProvider>
  );
}

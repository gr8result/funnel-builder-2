// /pages/_app.js
// FULL REPLACEMENT — removes GlobalDialer entirely (no floating dialer on every page)

import "../styles/globals.css";
import "../styles/elementor-icon-fonts.css";
import "@chaibuilder/sdk/styles";
import "react-image-crop/dist/ReactCrop.css";
import "../styles/sidenav.css";
import "../styles/marketplace-overhaul.css";
import Layout from "../components/Layout";
import { AuthProvider } from "../context/AuthContext";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";

// ── Thin top-of-page progress bar shown during route transitions ──────────────
function RouteProgressBar() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const timerRef = useRef(null);
  const crawlRef = useRef(null);

  useEffect(() => {
    function start() {
      setWidth(0);
      setVisible(true);
      // Quick jump to 20%, then slowly crawl toward 90%
      setTimeout(() => setWidth(20), 10);
      setTimeout(() => setWidth(50), 200);
      crawlRef.current = setInterval(() => {
        setWidth((w) => (w < 85 ? w + 2 : w));
      }, 400);
    }
    function finish() {
      clearInterval(crawlRef.current);
      setWidth(100);
      timerRef.current = setTimeout(() => {
        setVisible(false);
        setWidth(0);
      }, 400);
    }

    router.events.on("routeChangeStart", start);
    router.events.on("routeChangeComplete", finish);
    router.events.on("routeChangeError", finish);
    return () => {
      router.events.off("routeChangeStart", start);
      router.events.off("routeChangeComplete", finish);
      router.events.off("routeChangeError", finish);
      clearInterval(crawlRef.current);
      clearTimeout(timerRef.current);
    };
  }, [router]);

  if (!visible) return null;
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 99999,
      height: 3, pointerEvents: "none",
    }}>
      <div style={{
        height: "100%",
        width: `${width}%`,
        background: "linear-gradient(90deg, #3b82f6, #06b6d4)",
        transition: width === 100 ? "width 0.2s ease" : "width 0.4s ease",
        boxShadow: "0 0 8px rgba(59,130,246,0.7)",
        borderRadius: "0 2px 2px 0",
      }} />
    </div>
  );
}

export default function MyApp({ Component, pageProps }) {
  const router = useRouter();
  const actualPath = String(router.asPath || "").split("?")[0];
  const isErrorRoute = router.pathname === "/404" || router.pathname === "/500" || router.pathname === "/_error";

  const noLayoutRoutes = [
    "/account",
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
        <RouteProgressBar />
        <Root>
          <Component {...pageProps} />
        </Root>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <RouteProgressBar />
      <Root>
        <Layout>
          <Component {...pageProps} />
        </Layout>
      </Root>
    </AuthProvider>
  );
}

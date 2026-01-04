// /pages/_app.js
// FULL REPLACEMENT — removes GlobalDialer entirely (no floating dialer on every page)

import "../styles/globals.css";
import "../styles/sidenav.css";
import Layout from "../components/Layout";
import { useRouter } from "next/router";


export default function MyApp({ Component, pageProps }) {
  const router = useRouter();

  const noLayoutRoutes = ["/account", "/login", "/signup"];
  const hideLayout = noLayoutRoutes.some((path) =>
    router.pathname.startsWith(path)
  );

  const Root = ({ children }) => (
    <div style={{ fontSize: 16, lineHeight: 1.4 }}>
      <style jsx global>{`
        html,
        body {
          font-size: 16px !important;
        }
        button,
        input,
        select,
        textarea {
          font-size: 16px !important;
        }
      `}</style>
      {children}
    </div>
  );

  if (hideLayout) {
    return (
      <Root>
        <Component {...pageProps} />
      </Root>
    );
  }

  return (
    <Root>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </Root>
  );
}

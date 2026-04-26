// /pages/_app.js
// FULL REPLACEMENT — removes GlobalDialer entirely (no floating dialer on every page)

import "../styles/globals.css";
import "@chaibuilder/sdk/styles";
import "react-image-crop/dist/ReactCrop.css";
import "../styles/sidenav.css";
import "../styles/marketplace-overhaul.css";
import Layout from "../components/Layout";
import { AuthProvider } from "../context/AuthContext";
import { useRouter } from "next/router";


export default function MyApp({ Component, pageProps }) {
  const router = useRouter();

  const noLayoutRoutes = [
    "/account",
    "/login",
    "/signup",
    "/verify-email",
    "/legal/vendor-agreement",
    "/reset-password",
    "/u/",
    "/p/",
    "/modules/website-builder/project/[id]/preview",
  ];
  const hideLayout = noLayoutRoutes.some((path) =>
    router.pathname.startsWith(path)
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
        <Root>
          <Component {...pageProps} />
        </Root>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <Root>
        <Layout>
          <Component {...pageProps} />
        </Layout>
      </Root>
    </AuthProvider>
  );
}

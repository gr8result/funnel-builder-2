// /pages/_document.js
import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html>
      <Head>
        {/* ✅ Twilio Voice JS SDK (NOT the old client SDK) */}
        <script
          src="https://sdk.twilio.com/js/voice/releases/2.12.1/twilio.min.js"
          defer
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

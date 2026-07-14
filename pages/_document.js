// /pages/_document.js
import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html>
      <Head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                function isBenignLockAbort(error) {
                  var message = String((error && error.message) || error || "");
                  var name = String((error && error.name) || "");
                  var stack = String((error && error.stack) || "");
                  var combined = (name + " " + message + " " + stack).toLowerCase();
                  return combined.indexOf("lock broken by another request") !== -1
                    || (combined.indexOf("aborterror") !== -1 && combined.indexOf("lock broken") !== -1)
                    || (combined.indexOf("aborterror") !== -1 && combined.indexOf("steal") !== -1)
                    || (combined.indexOf("lock") !== -1 && combined.indexOf("steal") !== -1);
                }

                function stop(event) {
                  var error = event && (event.reason || event.error || event);
                  if (!isBenignLockAbort(error)) return;
                  if (event && typeof event.preventDefault === "function") event.preventDefault();
                  if (event && typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
                  return false;
                }

                window.__gr8IsBenignLockAbort = isBenignLockAbort;
                window.addEventListener("error", stop, true);
                window.addEventListener("unhandledrejection", stop, true);

                var originalReportError = window.reportError;
                if (typeof originalReportError === "function" && !window.__gr8ReportErrorPatched) {
                  window.__gr8ReportErrorPatched = true;
                  window.reportError = function (error) {
                    if (isBenignLockAbort(error)) return;
                    return originalReportError.call(window, error);
                  };
                }
              })();
            `,
          }}
        />
        {/* Google Fonts — loaded once for the whole app, available in canvas + font picker */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto:wght@400;500;700&family=Open+Sans:wght@400;600;700&family=Lato:wght@400;700&family=Montserrat:wght@400;600;700&family=Poppins:wght@400;500;600;700&family=Nunito:wght@400;600;700&family=Raleway:wght@400;600;700&family=Oswald:wght@400;600;700&family=Merriweather:wght@400;700&family=Playfair+Display:wght@400;600;700&family=DM+Serif+Display&family=Cormorant+Garamond:wght@400;600;700&family=Bebas+Neue&family=Josefin+Sans:wght@400;600;700&family=Quicksand:wght@400;600;700&family=Mulish:wght@400;600;700&family=Barlow:wght@400;600;700&family=Exo+2:wght@400;600;700&family=Source+Sans+3:wght@400;600;700&family=Work+Sans:wght@400;600;700&family=Rubik:wght@400;500;700&family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@400;500;700&family=Urbanist:wght@400;600;700&family=Syne:wght@400;700&family=Manrope:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;600;700&family=Figtree:wght@400;600;700&family=Outfit:wght@400;500;700&family=Jost:wght@400;600;700&family=Oxanium:wght@400;600;700&family=Orbitron:wght@400;700&family=Exo:wght@400;700&family=Rajdhani:wght@400;600;700&family=Cinzel:wght@400;700&family=EB+Garamond:wght@400;700&family=Libre+Baskerville:wght@400;700&family=Spectral:wght@400;600;700&family=Crimson+Text:wght@400;600;700&family=Lora:wght@400;600;700&family=PT+Serif:wght@400;700&family=Source+Serif+4:wght@400;600;700&family=Pacifico&family=Dancing+Script:wght@400;700&family=Sacramento&family=Great+Vibes&family=Caveat:wght@400;700&family=Kalam:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

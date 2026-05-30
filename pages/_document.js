// /pages/_document.js
import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html>
      <Head>
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

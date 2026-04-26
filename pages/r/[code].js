// D:\dev\funnel-builder-clean\pages\r\[code].js
// FULL REPLACEMENT
//
// ✅ Sets affiliate cookie for N days (default 90)
// ✅ Redirects to target sales page
// ✅ Forces ?ref=TRACKING_CODE onto destination URL
//
// Usage (what your app will generate/copy):
// /r/GR8-XXXX?to=<ENCODED_SALES_URL>&days=90
//
// Cookie:
// - name: gr8_aff_ref
// - value: tracking code
// - duration: days param (default 90)

export async function getServerSideProps(ctx) {
  const trackingCode = typeof ctx.params?.code === "string" ? ctx.params.code.trim() : "";
  const toRaw = typeof ctx.query?.to === "string" ? ctx.query.to.trim() : "";
  const daysRaw = typeof ctx.query?.days === "string" ? ctx.query.days.trim() : "";

  const daysNum = Number(daysRaw);
  const cookieDays = Number.isFinite(daysNum) && daysNum > 0 ? daysNum : 90;
  const maxAge = Math.floor(cookieDays * 24 * 60 * 60);

  let destination = "";

  try {
    if (toRaw) {
      const u = new URL(toRaw);
      if (trackingCode) u.searchParams.set("ref", trackingCode);
      destination = u.toString();
    }
  } catch {
    destination = "";
  }

  if (!destination) {
    destination = "/modules/affiliates/affiliate-marketplace";
  }

  // Secure cookie only on HTTPS
  const proto = (ctx.req.headers["x-forwarded-proto"] || "").toString();
  const isHttps = proto.includes("https");

  const cookieParts = [
    `gr8_aff_ref=${encodeURIComponent(trackingCode || "")}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "SameSite=Lax",
  ];

  if (isHttps) cookieParts.push("Secure");

  ctx.res.setHeader("Set-Cookie", cookieParts.join("; "));

  return {
    redirect: {
      destination,
      permanent: false,
    },
  };
}

export default function AffiliateCookieRedirect() {
  return null;
}

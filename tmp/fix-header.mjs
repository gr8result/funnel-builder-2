import { readFileSync, writeFileSync } from "fs";

const f = "d:/dev/funnel-builder-clean/pages/u/[username].js";
let src = readFileSync(f, "utf8");

// Replace the header styles block
src = src.replace(
  /const accent = profile\?\.booking_accent_color \|\| "#84cc16";[\s\S]*?headerSub:\s+\{[^}]+\},/,
  `const accent = profile?.booking_accent_color || "#84cc16";
  const headerTitle = profile?.booking_page_title || \`Book with \${profile?.username}\`;
  const headerBio   = profile?.booking_page_bio   || "Select a time that works for you";
  const logoUrl     = profile?.booking_logo_url   || null;

  // --- Styles ---
  const S = {
    page:         { minHeight: "100vh", background: "#0c121a", color: "#fff", fontFamily: "system-ui, -apple-system, sans-serif" },
    header:       { background: "#0c121a", borderBottom: \`3px solid \${accent}\`, padding: "22px 24px 18px" },
    headerInner:  { maxWidth: 640, margin: "0 auto", display: "flex", alignItems: "center", gap: 16 },
    avatar:       { width: 52, height: 52, borderRadius: 10, background: accent, border: \`2px solid \${accent}\`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: "#fff", flexShrink: 0, overflow: "hidden" },
    headerTitle:  { fontSize: 20, fontWeight: 700, color: "#fff", margin: 0 },
    headerSub:    { fontSize: 14, color: "#9CA3AF", marginTop: 4, marginBottom: 0 },`
);

// Also fix the header const block that was de-duped by previous edit leaving old headerTitle/headerBio
src = src.replace(
  /const headerTitle = profile\?\.booking_page_title \|\| `Book with \$\{profile\?\.username\}`;\s*const headerBio[\s\S]*?const headerTitle/,
  "const headerTitle"
);

writeFileSync(f, src, "utf8");
console.log("Done");

import Link from "next/link";
import { useEffect, useState } from "react";
import supabaseDefault, { supabase as supabaseNamed } from "../utils/supabase-client";
const supabase = supabaseNamed || supabaseDefault;

export default function RequireModule({ slug, children }) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return setOk(false);
      const { data } = await supabase
        .from("entitlements")
        .select("module_slug")
        .eq("user_id", user.id)
        .eq("module_slug", slug)
        .eq("active", true)
        .limit(1);
      setOk(!!(data && data.length));
    })();
  }, [slug]);

  if (!ok) {
    return (
      <div style={{ padding: 24 }}>
        <h2>This module isn’t active</h2>
        <p style={{ colour: "#9aa0a6", color: "#9aa0a6" }}>
          Purchase it on the{" "}
          <Link href="/billing" style={{ color: "#8ab4f8", textDecoration: "none" }}>
            Billing & Modules
          </Link>{" "}
          page.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}

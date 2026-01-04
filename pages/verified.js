// /pages/verified.js
// Automatically routes verified users if session exists

import { useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "../utils/supabase-client";

export default function Verified() {
  const router = useRouter();

  useEffect(() => {
    const handleRouting = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.replace("/verify-login");

      const { data: profile } = await supabase
        .from("profiles")
        .select("approved")
        .eq("user_id", user.id)
        .single();

      if (!profile) router.replace("/account");
      else if (!profile.approved) router.replace("/billing");
      else router.replace("/dashboard");
    };
    handleRouting();
  }, [router]);

  return (
    <div style={wrap}>
      <div style={box}>
        <h1>Verifying your account...</h1>
        <p>Please wait while we redirect you to the correct page.</p>
      </div>
    </div>
  );
}

const wrap = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0c121a", color: "#fff" };
const box = { background: "#111827", padding: "40px", borderRadius: 12, border: "1px solid #1f2937", maxWidth: 400 };

// pages/logout.js
import { useEffect } from "react";
import { useRouter } from "next/router";
import supabase from "../utils/supabase-client";

export default function Logout() {
  const router = useRouter();

  useEffect(() => {
    const doLogout = async () => {
      await supabase.auth.signOut();
      router.replace("/login"); // âœ… Redirects to login page
    };
    doLogout();
  }, [router]);

  return null;
}


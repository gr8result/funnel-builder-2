// pages/index.js
// Logged-in users go to the dashboard; everyone else sees the public landing page.

import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import Welcome from "./welcome";

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  // Show nothing while checking auth (avoids flash)
  if (loading) return null;

  // Authenticated users are being redirected; don't flash the landing page
  if (user) return null;

  return <Welcome />;
}

Index.disableLayout = true;


// /pages/settings/team.js
// Redirects to the unified Team Management page
import { useEffect } from "react";
import { useRouter } from "next/router";

export default function TeamRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/modules/email/crm/teams");
  }, [router]);
  return null;
}

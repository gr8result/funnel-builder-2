// Redirect to canonical email plans page
import { useEffect } from "react";
import { useRouter } from "next/router";

export default function EmailPlansRedirect() {
  const router = useRouter();
  useEffect(() => {
    const query = new URLSearchParams(window.location.search).toString();
    router.replace(query ? `/modules/billing/email-plans?${query}` : "/modules/billing/email-plans");
  }, [router]);
  return null;
}

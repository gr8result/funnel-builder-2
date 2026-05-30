// /pages/pricing.js -- redirects to the merged Pricing & Billing page
import { useEffect } from "react";
import { useRouter } from "next/router";

export default function PricingRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/billing");
  }, [router]);
  return null;
}

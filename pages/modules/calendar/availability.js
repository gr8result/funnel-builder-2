// Merged into /modules/calendar/settings
import { useEffect } from "react";
import { useRouter } from "next/router";

export default function AvailabilityRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/modules/calendar/settings"); }, []);
  return null;
}

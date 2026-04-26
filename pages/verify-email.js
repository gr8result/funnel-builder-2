import { useEffect } from "react";
import { useRouter } from "next/router";

export default function VerifyEmailCompatRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) return;
    const code = typeof router.query.code === "string" ? router.query.code : "";
    const destination = code
      ? `/marketplace?code=${encodeURIComponent(code)}`
      : "/marketplace";
    router.replace(destination);
  }, [router.isReady, router.query.code]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020817] text-white">
      Redirecting to marketplace...
    </div>
  );
}

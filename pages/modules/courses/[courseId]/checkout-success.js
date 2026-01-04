import { useEffect } from "react";
import { useRouter } from "next/router";

export default function CheckoutSuccess() {
  const router = useRouter();
  const { courseId } = router.query;

  useEffect(() => {
    if (!courseId) return;
    const t = setTimeout(() => {
      router.replace(`/pages/modules/courses/${courseId}/learn`);
    }, 800);
    return () => clearTimeout(t);
  }, [courseId]);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 900 }}>Payment Successful ✅</h1>
      <p style={{ marginTop: 8 }}>Redirecting you back to your course…</p>
    </div>
  );
}

// /pages/checkout/success.js
import { useEffect } from "react";
import { useRouter } from "next/router";

export default function CheckoutSuccess() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace("/dashboard");
    }, 3000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="wrap">
      <div className="card">
        <h1>✅ Payment Confirmed</h1>
        <p>Your subscription has been activated successfully.</p>
        <p>You’ll be redirected to your dashboard in a few seconds.</p>
      </div>

      <style jsx>{`
        .wrap {
          min-height: 100vh;
          background: #0c121a;
          display: flex;
          justify-content: center;
          align-items: center;
          color: #fff;
        }
        .card {
          background: #111827;
          border: 1px solid #333;
          padding: 40px;
          border-radius: 12px;
          text-align: center;
          width: 90%;
          max-width: 500px;
        }
        h1 {
          color: #22c55e;
          font-size: 26px;
          margin-bottom: 12px;
        }
      `}</style>
    </div>
  );
}

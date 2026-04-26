import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

export default function MarketplaceResetPassword() {
  const router = useRouter();
  const token = String(router.query?.token || "");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!token) {
      setError("Invalid or missing reset token.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/marketplace-password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Unable to reset password.");
        return;
      }

      setSuccess("Password reset successful. Redirecting to login...");
      setTimeout(() => router.push("/marketplace/login"), 1200);
    } catch {
      setError("Unable to reset password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020817]">
      <div className="bg-[#181f2e] rounded-xl p-10 shadow-lg w-full max-w-md">
        <h2 className="text-3xl font-bold mb-6 text-center text-blue-400">Reset Marketplace Password</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-[#222] rounded px-4 py-2 text-white border border-slate-700 pr-10 w-full"
              required
            />
            <span
              onClick={() => setShowPassword((v) => !v)}
              style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "#aaa", fontSize: 20 }}
              tabIndex={0}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "👁️" : "🙈"}
            </span>
          </div>

          <div style={{ position: "relative" }}>
            <input
              type={showConfirm ? "text" : "password"}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-[#222] rounded px-4 py-2 text-white border border-slate-700 pr-10 w-full"
              required
            />
            <span
              onClick={() => setShowConfirm((v) => !v)}
              style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "#aaa", fontSize: 20 }}
              tabIndex={0}
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              {showConfirm ? "👁️" : "🙈"}
            </span>
          </div>

          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-lg mt-2"
            disabled={loading}
          >
            {loading ? "Updating..." : "Reset Password"}
          </button>

          {error && <div className="text-red-400 text-center">{error}</div>}
          {success && <div className="text-green-400 text-center">{success}</div>}
        </form>

        <div className="mt-6 pt-5 border-t border-slate-700/70 text-center">
          <Link href="/marketplace/login" className="text-blue-300 hover:text-blue-200 font-semibold underline">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}

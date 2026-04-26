import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

export default function MarketplaceLogin() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [success, setSuccess] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    setSuccess(false);
    try {
      const res = await fetch('/api/marketplace-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email })
      });
      const user = await res.json();
      console.log('Fetched user:', user);
      if (!user || !user.password_hash) {
        setError('Invalid email or password.');
        setLoading(false);
        return;
      }
      // Hash entered password
      const hashPassword = async (pw) => {
        const enc = new TextEncoder();
        const buf = await window.crypto.subtle.digest('SHA-256', enc.encode(pw));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      };
      const enteredHash = await hashPassword(form.password);
      console.log('Entered hash:', enteredHash);
      console.log('User hash:', user.password_hash);
      if (enteredHash !== user.password_hash) {
        setError('Invalid email or password.');
        setLoading(false);
        return;
      }
      if (!user.verified || !user.phone_verified) {
        setError('Please confirm your email and phone have been verified so you can log in. Check your email for confirmation.');
        setLoading(false);
        return;
      }
      setSuccess(true);
      // Store user_code for marketplace display
      if (typeof window !== 'undefined' && user.user_code) {
        localStorage.setItem('xchange_user_code', user.user_code);
      }
      // Redirect directly to marketplace after successful login
      setTimeout(() => {
        router.push("/marketplace");
      }, 800);
    } catch (err) {
      setError('Login failed. Please try again.');
    }
    setLoading(false);
  }

  async function handleForgotPassword() {
    setError(null);
    setInfo(null);

    const email = String(form.email || "").trim().toLowerCase();
    if (!email) {
      setError("Enter your email first, then click Forgot Password.");
      return;
    }

    setSendingReset(true);
    try {
      const res = await fetch("/api/marketplace-password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Failed to send reset email.");
        return;
      }

      setInfo("If this email exists, a password reset link has been sent.");
    } catch {
      setError("Failed to send reset email.");
    } finally {
      setSendingReset(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020817]">
      <div className="bg-[#181f2e] rounded-xl p-10 shadow-lg w-full max-w-md">
        <h2 className="text-3xl font-bold mb-6 text-center text-blue-400">Xchange Marketplace Login</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            className="bg-[#222] rounded px-4 py-2 text-white border border-slate-700"
            required
          />
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              className="bg-[#222] rounded px-4 py-2 text-white border border-slate-700 pr-10 w-full"
              required
            />
            <span
              onClick={() => setShowPassword(v => !v)}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#aaa', fontSize: 20 }}
              tabIndex={0}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ?  '👁️':'🙈'}
            </span>
          </div>
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-lg mt-2"
            disabled={loading}
          >
            {loading ? 'Logging in…' : 'Log In'}
          </button>
          {error && <div className="text-red-400 text-center">{error}</div>}
          {info && <div className="text-blue-300 text-center">{info}</div>}
          {success && <div className="text-green-400 text-center">Login successful!</div>}
        </form>

        <div className="mt-6 pt-5 border-t border-slate-700/70 flex flex-col gap-3 text-center">
          <Link
            href="/marketplace"
            className="text-blue-300 hover:text-blue-200 font-semibold underline"
          >
            Create New Account
          </Link>

          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={sendingReset}
            className="text-slate-300 hover:text-white underline disabled:opacity-70"
          >
            {sendingReset ? "Sending reset email..." : "Forgot Password? Send reset email"}
          </button>
        </div>
      </div>
    </div>
  );
}

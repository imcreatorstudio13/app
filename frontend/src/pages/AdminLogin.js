import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Store, Loader2, Lock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";

export default function AdminLogin() {
  const { user, ready, adminLogin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (ready && user && user.role === "admin") navigate("/admin/dashboard", { replace: true }); }, [ready, user, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await adminLogin(email, password);
      toast.success("Welcome back");
      navigate("/admin/dashboard");
    } catch (err) {
      toast.error(apiError(err.response?.data?.detail) || "Login failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-[#14171A] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="inline-grid place-items-center w-14 h-14 rounded-2xl bg-[#D96B43] text-white mb-4"><Store size={26} /></span>
          <h1 className="font-heading text-2xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-white/50 text-sm mt-1">Studio Market 41 management</p>
        </div>
        <form onSubmit={submit} className="bg-white rounded-2xl p-6 space-y-4 shadow-2xl">
          <div>
            <label className="text-sm font-medium text-[#2C3531]">Email</label>
            <input data-testid="admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="mt-2 w-full rounded-xl border border-[#E5E0D8] px-4 py-3 outline-none focus:border-[#D96B43]" />
          </div>
          <div>
            <label className="text-sm font-medium text-[#2C3531]">Password</label>
            <input data-testid="admin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="mt-2 w-full rounded-xl border border-[#E5E0D8] px-4 py-3 outline-none focus:border-[#D96B43]" />
          </div>
          <button data-testid="admin-login-btn" disabled={loading} type="submit"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#D96B43] hover:bg-[#C25933] text-white font-semibold disabled:opacity-50">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />} Sign In
          </button>
          <p className="text-center text-sm text-[#6B7280]">
            Need an admin account?{" "}
            <button type="button" data-testid="to-admin-register" onClick={() => navigate("/admin/register")} className="text-[#D96B43] font-semibold hover:underline">Register</button>
          </p>
          <div className="text-center">
            <button type="button" data-testid="admin-forgot" onClick={() => navigate("/forgot-password")} className="text-sm text-[#6B7280] hover:text-[#D96B43]">Forgot password?</button>
          </div>
        </form>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Store, Loader2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";

export default function UserLogin() {
  const { user, ready, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (ready && user && user.role === "user") navigate("/my-bookings", { replace: true }); }, [ready, user, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back");
      navigate("/my-bookings");
    } catch (err) {
      toast.error(apiError(err.response?.data?.detail) || "Login failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-[#FBF9F5] px-4">
      <div className="w-full max-w-sm">
        <button onClick={() => navigate("/")} className="mb-6 inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#D96B43]"><ArrowLeft size={16} /> Back home</button>
        <div className="text-center mb-8">
          <span className="inline-grid place-items-center w-14 h-14 rounded-2xl bg-[#D96B43] text-white mb-4"><Store size={26} /></span>
          <h1 className="font-heading text-2xl font-bold text-[#1C2120]">Welcome back</h1>
          <p className="text-[#6B7280] text-sm mt-1">Log in to view and manage your bookings</p>
        </div>
        <form onSubmit={submit} className="bg-white rounded-2xl p-6 space-y-4 shadow-sm border border-[#E5E0D8]">
          <div>
            <label className="text-sm font-medium text-[#2C3531]">Email</label>
            <input data-testid="user-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="mt-2 w-full rounded-xl border border-[#E5E0D8] px-4 py-3 outline-none focus:border-[#D96B43]" />
          </div>
          <div>
            <label className="text-sm font-medium text-[#2C3531]">Password</label>
            <input data-testid="user-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="mt-2 w-full rounded-xl border border-[#E5E0D8] px-4 py-3 outline-none focus:border-[#D96B43]" />
          </div>
          <button data-testid="user-login-btn" disabled={loading} type="submit"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#D96B43] hover:bg-[#C25933] text-white font-semibold disabled:opacity-50">
            {loading && <Loader2 size={16} className="animate-spin" />} Sign In
          </button>
          <div className="text-center">
            <button type="button" data-testid="user-forgot" onClick={() => navigate("/forgot-password")} className="text-sm text-[#6B7280] hover:text-[#D96B43]">Forgot password?</button>
          </div>
          <p className="text-center text-sm text-[#6B7280]">
            New here?{" "}
            <button type="button" data-testid="to-user-register" onClick={() => navigate("/register")} className="text-[#D96B43] font-semibold hover:underline">Create an account</button>
          </p>
        </form>
        <p className="mt-6 text-center text-xs text-[#6B7280]">
          Studio Market 41 staff? <button onClick={() => navigate("/admin/login")} className="text-[#5C6B57] font-medium hover:underline">Admin login</button>
        </p>
      </div>
    </div>
  );
}

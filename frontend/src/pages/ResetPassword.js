import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Store, Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";

export default function ResetPassword() {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { toast.error("Passwords do not match"); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      toast.error(apiError(err.response?.data?.detail) || "Reset failed");
    } finally { setLoading(false); }
  };

  if (!token) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#FBF9F5] px-4">
        <div className="text-center max-w-sm">
          <h1 className="font-heading text-2xl font-semibold text-[#1C2120]">Invalid reset link</h1>
          <p className="mt-2 text-[#6B7280] text-sm">This link is missing its token. Please request a new reset email.</p>
          <button onClick={() => navigate("/forgot-password")} className="mt-6 px-6 py-3 rounded-full bg-[#D96B43] text-white font-semibold text-sm">Request new link</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center bg-[#FBF9F5] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="inline-grid place-items-center w-14 h-14 rounded-2xl bg-[#D96B43] text-white mb-4"><Store size={26} /></span>
          <h1 className="font-heading text-2xl font-bold text-[#1C2120]">Set a new password</h1>
        </div>
        {done ? (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-[#E5E0D8] text-center" data-testid="reset-done">
            <span className="inline-grid place-items-center w-12 h-12 rounded-full bg-[#10B981]/15 text-[#10B981] mb-3"><CheckCircle2 size={26} /></span>
            <p className="text-[#1C2120] font-medium">Password updated</p>
            <p className="text-sm text-[#6B7280] mt-2">You can now log in with your new password.</p>
            <div className="mt-6 flex gap-3 justify-center">
              <button onClick={() => navigate("/login")} className="px-6 py-3 rounded-full bg-[#D96B43] text-white font-semibold text-sm">User login</button>
              <button onClick={() => navigate("/admin/login")} className="px-6 py-3 rounded-full bg-white border border-[#E5E0D8] text-[#1C2120] font-semibold text-sm">Admin login</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="bg-white rounded-2xl p-6 space-y-4 shadow-sm border border-[#E5E0D8]">
            <div>
              <label className="text-sm font-medium text-[#2C3531]">New Password</label>
              <input data-testid="reset-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                className="mt-2 w-full rounded-xl border border-[#E5E0D8] px-4 py-3 outline-none focus:border-[#D96B43]" />
            </div>
            <div>
              <label className="text-sm font-medium text-[#2C3531]">Confirm Password</label>
              <input data-testid="reset-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required
                className="mt-2 w-full rounded-xl border border-[#E5E0D8] px-4 py-3 outline-none focus:border-[#D96B43]" />
            </div>
            <button data-testid="reset-submit" disabled={loading} type="submit"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#D96B43] hover:bg-[#C25933] text-white font-semibold disabled:opacity-50">
              {loading && <Loader2 size={16} className="animate-spin" />} Update Password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

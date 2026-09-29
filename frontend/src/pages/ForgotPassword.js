import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Store, Loader2, ArrowLeft, MailCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";

export default function ForgotPassword() {
  const { forgotPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await forgotPassword(email, window.location.origin);
      setSent(true);
    } catch (err) {
      toast.error(apiError(err.response?.data?.detail) || "Something went wrong");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-[#FBF9F5] px-4">
      <div className="w-full max-w-sm">
        <button onClick={() => navigate("/login")} className="mb-6 inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#D96B43]"><ArrowLeft size={16} /> Back to login</button>
        <div className="text-center mb-8">
          <span className="inline-grid place-items-center w-14 h-14 rounded-2xl bg-[#D96B43] text-white mb-4"><Store size={26} /></span>
          <h1 className="font-heading text-2xl font-bold text-[#1C2120]">Forgot your password?</h1>
          <p className="text-[#6B7280] text-sm mt-1">We'll email you a link to reset it.</p>
        </div>
        {sent ? (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-[#E5E0D8] text-center" data-testid="forgot-sent">
            <span className="inline-grid place-items-center w-12 h-12 rounded-full bg-[#10B981]/15 text-[#10B981] mb-3"><MailCheck size={26} /></span>
            <p className="text-[#1C2120] font-medium">Check your inbox</p>
            <p className="text-sm text-[#6B7280] mt-2">If an account exists for <strong>{email}</strong>, a password reset link is on its way. The link expires in 1 hour.</p>
            <button onClick={() => navigate("/login")} className="mt-6 px-6 py-3 rounded-full bg-[#D96B43] text-white font-semibold text-sm">Back to login</button>
          </div>
        ) : (
          <form onSubmit={submit} className="bg-white rounded-2xl p-6 space-y-4 shadow-sm border border-[#E5E0D8]">
            <div>
              <label className="text-sm font-medium text-[#2C3531]">Email</label>
              <input data-testid="forgot-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="mt-2 w-full rounded-xl border border-[#E5E0D8] px-4 py-3 outline-none focus:border-[#D96B43]" />
            </div>
            <button data-testid="forgot-submit" disabled={loading} type="submit"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#D96B43] hover:bg-[#C25933] text-white font-semibold disabled:opacity-50">
              {loading && <Loader2 size={16} className="animate-spin" />} Send Reset Link
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

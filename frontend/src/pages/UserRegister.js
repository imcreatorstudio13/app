import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Store, Loader2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";

export default function UserRegister() {
  const { user, ready, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm({ ...form, [k]: v });

  useEffect(() => { if (ready && user && user.role === "user") navigate("/my-bookings", { replace: true }); }, [ready, user, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form);
      toast.success("Account created");
      navigate("/my-bookings");
    } catch (err) {
      toast.error(apiError(err.response?.data?.detail) || "Registration failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-[#FBF9F5] px-4 py-10">
      <div className="w-full max-w-sm">
        <button onClick={() => navigate("/")} className="mb-6 inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#D96B43]"><ArrowLeft size={16} /> Back home</button>
        <div className="text-center mb-8">
          <span className="inline-grid place-items-center w-14 h-14 rounded-2xl bg-[#D96B43] text-white mb-4"><Store size={26} /></span>
          <h1 className="font-heading text-2xl font-bold text-[#1C2120]">Create your account</h1>
          <p className="text-[#6B7280] text-sm mt-1">Book faster and track your reservations</p>
        </div>
        <form onSubmit={submit} className="bg-white rounded-2xl p-6 space-y-4 shadow-sm border border-[#E5E0D8]">
          <div>
            <label className="text-sm font-medium text-[#2C3531]">Full Name</label>
            <input data-testid="reg-name" value={form.name} onChange={(e) => set("name", e.target.value)} required
              className="mt-2 w-full rounded-xl border border-[#E5E0D8] px-4 py-3 outline-none focus:border-[#D96B43]" />
          </div>
          <div>
            <label className="text-sm font-medium text-[#2C3531]">Email</label>
            <input data-testid="reg-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required
              className="mt-2 w-full rounded-xl border border-[#E5E0D8] px-4 py-3 outline-none focus:border-[#D96B43]" />
          </div>
          <div>
            <label className="text-sm font-medium text-[#2C3531]">Phone (optional)</label>
            <input data-testid="reg-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)}
              className="mt-2 w-full rounded-xl border border-[#E5E0D8] px-4 py-3 outline-none focus:border-[#D96B43]" />
          </div>
          <div>
            <label className="text-sm font-medium text-[#2C3531]">Password</label>
            <input data-testid="reg-password" type="password" value={form.password} onChange={(e) => set("password", e.target.value)} required minLength={6}
              className="mt-2 w-full rounded-xl border border-[#E5E0D8] px-4 py-3 outline-none focus:border-[#D96B43]" />
            <p className="mt-1 text-xs text-[#6B7280]">At least 6 characters.</p>
          </div>
          <button data-testid="user-register-btn" disabled={loading} type="submit"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#D96B43] hover:bg-[#C25933] text-white font-semibold disabled:opacity-50">
            {loading && <Loader2 size={16} className="animate-spin" />} Create Account
          </button>
          <p className="text-center text-sm text-[#6B7280]">
            Already have an account?{" "}
            <button type="button" data-testid="to-user-login" onClick={() => navigate("/login")} className="text-[#D96B43] font-semibold hover:underline">Log in</button>
          </p>
        </form>
      </div>
    </div>
  );
}

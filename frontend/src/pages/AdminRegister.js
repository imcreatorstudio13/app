import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Store, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";

export default function AdminRegister() {
  const { user, ready, adminRegister } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", admin_code: "" });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm({ ...form, [k]: v });

  useEffect(() => { if (ready && user && user.role === "admin") navigate("/admin/dashboard", { replace: true }); }, [ready, user, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await adminRegister(form);
      toast.success("Admin account created");
      navigate("/admin/dashboard");
    } catch (err) {
      toast.error(apiError(err.response?.data?.detail) || "Registration failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-[#14171A] px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="inline-grid place-items-center w-14 h-14 rounded-2xl bg-[#D96B43] text-white mb-4"><Store size={26} /></span>
          <h1 className="font-heading text-2xl font-bold text-white">Create admin account</h1>
          <p className="text-white/50 text-sm mt-1">Requires a valid admin registration code</p>
        </div>
        <form onSubmit={submit} className="bg-white rounded-2xl p-6 space-y-4 shadow-2xl">
          <div>
            <label className="text-sm font-medium text-[#2C3531]">Full Name</label>
            <input data-testid="admin-reg-name" value={form.name} onChange={(e) => set("name", e.target.value)} required
              className="mt-2 w-full rounded-xl border border-[#E5E0D8] px-4 py-3 outline-none focus:border-[#D96B43]" />
          </div>
          <div>
            <label className="text-sm font-medium text-[#2C3531]">Email</label>
            <input data-testid="admin-reg-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required
              className="mt-2 w-full rounded-xl border border-[#E5E0D8] px-4 py-3 outline-none focus:border-[#D96B43]" />
          </div>
          <div>
            <label className="text-sm font-medium text-[#2C3531]">Password</label>
            <input data-testid="admin-reg-password" type="password" value={form.password} onChange={(e) => set("password", e.target.value)} required minLength={6}
              className="mt-2 w-full rounded-xl border border-[#E5E0D8] px-4 py-3 outline-none focus:border-[#D96B43]" />
          </div>
          <div>
            <label className="text-sm font-medium text-[#2C3531] flex items-center gap-1.5"><ShieldCheck size={14} className="text-[#5C6B57]" /> Admin Code</label>
            <input data-testid="admin-reg-code" value={form.admin_code} onChange={(e) => set("admin_code", e.target.value)} required
              placeholder="Provided by Studio Market 41"
              className="mt-2 w-full rounded-xl border border-[#E5E0D8] px-4 py-3 outline-none focus:border-[#D96B43]" />
          </div>
          <button data-testid="admin-register-btn" disabled={loading} type="submit"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#D96B43] hover:bg-[#C25933] text-white font-semibold disabled:opacity-50">
            {loading && <Loader2 size={16} className="animate-spin" />} Create Admin
          </button>
          <p className="text-center text-sm text-[#6B7280]">
            Already an admin?{" "}
            <button type="button" data-testid="to-admin-login" onClick={() => navigate("/admin/login")} className="text-[#D96B43] font-semibold hover:underline">Sign in</button>
          </p>
        </form>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Store, LogOut, DollarSign, Clock, CalendarX, LayoutGrid, ClipboardList, FileText, Loader2, Trash2, Ban, Plus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api, { apiError } from "@/lib/api";

const TABS = [
  { id: "rates", label: "Rates & Hours", icon: DollarSign },
  { id: "blocks", label: "Blockouts", icon: CalendarX },
  { id: "stalls", label: "Stalls", icon: LayoutGrid },
  { id: "reservations", label: "Reservations", icon: ClipboardList },
  { id: "terms", label: "Terms & Policy", icon: FileText },
];

function hourLabel(h) { if (h == null) return ""; const s = h < 12 ? "AM" : "PM"; let d = h % 12; if (d === 0) d = 12; return `${d}:00 ${s}`; }

export default function AdminDashboard() {
  const { user, ready, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("rates");
  const [settings, setSettings] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [blocked, setBlocked] = useState({ dates: [], slots: [], unavailable: [] });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (ready && !user) navigate("/admin", { replace: true }); }, [ready, user, navigate]);

  const load = async () => {
    try {
      const [s, r, b] = await Promise.all([
        api.get("/settings"), api.get("/admin/reservations"), api.get("/admin/blocked"),
      ]);
      setSettings(s.data); setReservations(r.data); setBlocked(b.data);
    } catch (e) { toast.error("Failed to load dashboard"); }
  };
  useEffect(() => { if (ready && user) load(); }, [ready, user]);

  const saveSettings = async (patch) => {
    setSaving(true);
    try {
      const { data } = await api.put("/settings", patch);
      setSettings({ ...data, stalls: settings.stalls, rental_labels: settings.rental_labels });
      toast.success("Saved");
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  if (!ready || !settings) return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin text-[#D96B43]" /></div>;

  return (
    <div className="min-h-screen bg-[#FBF9F5]">
      <div className="bg-[#14171A] text-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid place-items-center w-10 h-10 rounded-xl bg-[#D96B43]"><Store size={20} /></span>
            <div>
              <div className="font-heading font-semibold leading-none">Studio Market 41</div>
              <div className="text-xs text-white/50 mt-1">Admin Dashboard</div>
            </div>
          </div>
          <button data-testid="logout-btn" onClick={() => { logout(); navigate("/admin"); }}
            className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white"><LogOut size={16} /> Sign out</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid lg:grid-cols-[220px_1fr] gap-8">
        <aside className="flex lg:flex-col gap-2 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.id} data-testid={`tab-${t.id}`} onClick={() => setTab(t.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${tab === t.id ? "bg-[#D96B43] text-white shadow-md" : "text-[#2C3531] hover:bg-white"}`}>
              <t.icon size={17} /> {t.label}
            </button>
          ))}
        </aside>

        <main>
          {tab === "rates" && <RatesTab settings={settings} setSettings={setSettings} save={saveSettings} saving={saving} />}
          {tab === "blocks" && <BlocksTab blocked={blocked} reload={load} settings={settings} />}
          {tab === "stalls" && <StallsTab blocked={blocked} reload={load} settings={settings} />}
          {tab === "reservations" && <ReservationsTab reservations={reservations} reload={load} />}
          {tab === "terms" && <TermsTab settings={settings} setSettings={setSettings} save={saveSettings} saving={saving} />}
        </main>
      </div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E0D8] p-6 mb-6">
      {title && <h2 className="font-heading text-lg font-semibold text-[#1C2120] mb-4">{title}</h2>}
      {children}
    </div>
  );
}
function NumField({ label, value, onChange, testid }) {
  return (
    <div>
      <label className="text-sm font-medium text-[#2C3531]">{label}</label>
      <input data-testid={testid} type="number" value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="mt-2 w-full rounded-xl border border-[#E5E0D8] px-4 py-2.5 outline-none focus:border-[#D96B43]" />
    </div>
  );
}

function RatesTab({ settings, setSettings, save, saving }) {
  const s = settings;
  const set = (k, v) => setSettings({ ...s, [k]: v });
  const setH = (grp, k, v) => setSettings({ ...s, [grp]: { ...s[grp], [k]: v } });
  return (
    <>
      <Card title="Rates">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <NumField label="Hourly rate ($/hr)" testid="rate-hourly" value={s.hourly_rate} onChange={(v) => set("hourly_rate", v)} />
          <NumField label="Daily rate ($)" testid="rate-daily" value={s.daily_rate} onChange={(v) => set("daily_rate", v)} />
          <NumField label="Weekly Mon–Fri ($)" testid="rate-mf" value={s.weekly_mf_rate} onChange={(v) => set("weekly_mf_rate", v)} />
          <NumField label="Weekly Mon–Sun ($)" testid="rate-msun" value={s.weekly_msun_rate} onChange={(v) => set("weekly_msun_rate", v)} />
          <NumField label="Minimum hours" testid="rate-min" value={s.min_hours} onChange={(v) => set("min_hours", v)} />
        </div>
      </Card>
      <Card title="Operating hours (24-hour)">
        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <div className="text-sm font-semibold text-[#D96B43] mb-2">Monday – Friday</div>
            <div className="grid grid-cols-2 gap-3">
              <NumField label="Open" testid="wd-open" value={s.hours_weekday.open} onChange={(v) => setH("hours_weekday", "open", v)} />
              <NumField label="Close" testid="wd-close" value={s.hours_weekday.close} onChange={(v) => setH("hours_weekday", "close", v)} />
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold text-[#D96B43] mb-2">Saturday – Sunday</div>
            <div className="grid grid-cols-2 gap-3">
              <NumField label="Open" testid="we-open" value={s.hours_weekend.open} onChange={(v) => setH("hours_weekend", "open", v)} />
              <NumField label="Close" testid="we-close" value={s.hours_weekend.close} onChange={(v) => setH("hours_weekend", "close", v)} />
            </div>
          </div>
        </div>
      </Card>
      <button data-testid="save-rates-btn" disabled={saving} onClick={() => save({
        hourly_rate: s.hourly_rate, daily_rate: s.daily_rate, weekly_mf_rate: s.weekly_mf_rate,
        weekly_msun_rate: s.weekly_msun_rate, min_hours: s.min_hours,
        hours_weekday: s.hours_weekday, hours_weekend: s.hours_weekend,
      })} className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#D96B43] text-white font-semibold disabled:opacity-50">
        {saving && <Loader2 size={16} className="animate-spin" />} Save changes
      </button>
    </>
  );
}

function BlocksTab({ blocked, reload, settings }) {
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState({ date: "", stall: "A", start: 7, end: 11 });

  const addDate = async () => {
    if (!date) return;
    try { await api.post("/admin/block-date", { date }); toast.success("Date blocked"); setDate(""); reload(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };
  const rmDate = async (d) => { await api.delete(`/admin/block-date/${d}`); toast.success("Unblocked"); reload(); };
  const addSlot = async () => {
    if (!slot.date) { toast.error("Pick a date"); return; }
    try { await api.post("/admin/block-slot", slot); toast.success("Slot blocked"); reload(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };
  const rmSlot = async (id) => { await api.delete(`/admin/block-slot/${id}`); toast.success("Removed"); reload(); };

  return (
    <>
      <Card title="Block full dates">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-sm font-medium text-[#2C3531]">Date</label>
            <input data-testid="block-date-input" type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="mt-2 block rounded-xl border border-[#E5E0D8] px-4 py-2.5 outline-none focus:border-[#D96B43]" />
          </div>
          <button data-testid="add-block-date" onClick={addDate} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#2C3531] text-white text-sm font-semibold"><Plus size={15} /> Block date</button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {blocked.dates.map((d) => (
            <span key={d.date} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F59E0B]/10 text-[#B45309] text-sm">
              {d.date} <button onClick={() => rmDate(d.date)}><Trash2 size={13} /></button>
            </span>
          ))}
          {blocked.dates.length === 0 && <span className="text-sm text-[#6B7280]">No blocked dates.</span>}
        </div>
      </Card>

      <Card title="Block specific time slots">
        <div className="grid sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="text-sm font-medium text-[#2C3531]">Date</label>
            <input data-testid="slot-date" type="date" value={slot.date} onChange={(e) => setSlot({ ...slot, date: e.target.value })}
              className="mt-2 block w-full rounded-xl border border-[#E5E0D8] px-3 py-2.5 outline-none focus:border-[#D96B43]" />
          </div>
          <div>
            <label className="text-sm font-medium text-[#2C3531]">Stall</label>
            <select data-testid="slot-stall" value={slot.stall} onChange={(e) => setSlot({ ...slot, stall: e.target.value })}
              className="mt-2 block w-full rounded-xl border border-[#E5E0D8] px-3 py-2.5 outline-none focus:border-[#D96B43]">
              {settings.stalls.map((st) => <option key={st}>{st}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-[#2C3531]">Start (hr)</label>
            <input data-testid="slot-start" type="number" value={slot.start} onChange={(e) => setSlot({ ...slot, start: parseInt(e.target.value) })}
              className="mt-2 block w-full rounded-xl border border-[#E5E0D8] px-3 py-2.5 outline-none focus:border-[#D96B43]" />
          </div>
          <div>
            <label className="text-sm font-medium text-[#2C3531]">End (hr)</label>
            <input data-testid="slot-end" type="number" value={slot.end} onChange={(e) => setSlot({ ...slot, end: parseInt(e.target.value) })}
              className="mt-2 block w-full rounded-xl border border-[#E5E0D8] px-3 py-2.5 outline-none focus:border-[#D96B43]" />
          </div>
        </div>
        <button data-testid="add-block-slot" onClick={addSlot} className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#2C3531] text-white text-sm font-semibold"><Plus size={15} /> Block slot</button>
        <div className="mt-4 space-y-2">
          {blocked.slots.map((sl) => (
            <div key={sl.id} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#FBF9F5] border border-[#E5E0D8] text-sm">
              <span>Stall {sl.stall} · {sl.date} · {hourLabel(sl.start)}–{hourLabel(sl.end)}</span>
              <button onClick={() => rmSlot(sl.id)} className="text-[#EF4444]"><Trash2 size={15} /></button>
            </div>
          ))}
          {blocked.slots.length === 0 && <span className="text-sm text-[#6B7280]">No blocked slots.</span>}
        </div>
      </Card>
    </>
  );
}

function StallsTab({ blocked, reload, settings }) {
  const toggle = async (stall, unavailable) => {
    try { await api.post("/admin/stall-unavailable", { stall, unavailable }); toast.success("Updated"); reload(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };
  return (
    <Card title="Stall availability">
      <p className="text-sm text-[#6B7280] mb-4">Mark a stall unavailable to remove it from all bookings (e.g. maintenance).</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {settings.stalls.map((st) => {
          const off = blocked.unavailable.includes(st);
          return (
            <div key={st} className={`p-5 rounded-2xl border-2 text-center ${off ? "border-[#EF4444]/40 bg-[#EF4444]/5" : "border-[#10B981]/40 bg-[#10B981]/5"}`}>
              <div className="font-heading text-3xl font-bold text-[#1C2120]">{st}</div>
              <div className={`text-xs font-semibold mt-1 ${off ? "text-[#EF4444]" : "text-[#10B981]"}`}>{off ? "Unavailable" : "Available"}</div>
              <button data-testid={`toggle-stall-${st}`} onClick={() => toggle(st, !off)}
                className={`mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold ${off ? "bg-[#10B981] text-white" : "bg-[#EF4444] text-white"}`}>
                <Ban size={13} /> {off ? "Mark available" : "Mark unavailable"}
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ReservationsTab({ reservations, reload }) {
  const cancel = async (id) => {
    if (!window.confirm("Cancel this reservation?")) return;
    try { await api.post(`/admin/reservations/${id}/cancel`); toast.success("Cancelled"); reload(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };
  const badge = (st) => st === "confirmed" ? "bg-[#10B981]/15 text-[#10B981]" : st === "cancelled" ? "bg-[#EF4444]/15 text-[#EF4444]" : "bg-[#F59E0B]/15 text-[#B45309]";
  return (
    <Card title={`Reservations (${reservations.length})`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="reservations-table">
          <thead>
            <tr className="text-left text-[#6B7280] border-b border-[#E5E0D8]">
              <th className="py-3 pr-4">Code</th><th className="py-3 pr-4">Vendor</th><th className="py-3 pr-4">Stall</th>
              <th className="py-3 pr-4">Date</th><th className="py-3 pr-4">Total</th><th className="py-3 pr-4">Status</th><th className="py-3"></th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((r) => (
              <tr key={r.id} className="border-b border-[#E5E0D8]/60" data-testid={`res-row-${r.confirmation_code}`}>
                <td className="py-3 pr-4 font-mono text-xs">{r.confirmation_code}</td>
                <td className="py-3 pr-4">
                  <div className="font-medium text-[#1C2120]">{r.customer?.business_name}</div>
                  <div className="text-xs text-[#6B7280]">{r.customer?.full_name} · {r.customer?.email}</div>
                </td>
                <td className="py-3 pr-4">{r.stalls?.join(" + ")}</td>
                <td className="py-3 pr-4">
                  {r.dates?.length > 1 ? `${r.dates[0]}…` : r.date}
                  {r.rental_type === "hourly" && <div className="text-xs text-[#6B7280]">{hourLabel(r.start_hour)}–{hourLabel(r.end_hour)}</div>}
                </td>
                <td className="py-3 pr-4 font-semibold">${r.total?.toFixed(2)}</td>
                <td className="py-3 pr-4"><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${badge(r.status)}`}>{r.status}</span></td>
                <td className="py-3">
                  {r.status !== "cancelled" && (
                    <button data-testid={`cancel-${r.confirmation_code}`} onClick={() => cancel(r.id)} className="text-[#EF4444] text-xs font-semibold hover:underline">Cancel</button>
                  )}
                </td>
              </tr>
            ))}
            {reservations.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-[#6B7280]">No reservations yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function TermsTab({ settings, setSettings, save, saving }) {
  const s = settings;
  const setAgreement = (i, v) => { const a = [...s.agreements]; a[i] = v; setSettings({ ...s, agreements: a }); };
  return (
    <>
      <Card title="Booking terms">
        <textarea data-testid="terms-text" rows={4} value={s.terms} onChange={(e) => setSettings({ ...s, terms: e.target.value })}
          className="w-full rounded-xl border border-[#E5E0D8] px-4 py-3 outline-none focus:border-[#D96B43] resize-none" />
      </Card>
      <Card title="Cancellation & refund policy">
        <textarea data-testid="cancel-text" rows={5} value={s.cancellation_policy} onChange={(e) => setSettings({ ...s, cancellation_policy: e.target.value })}
          className="w-full rounded-xl border border-[#E5E0D8] px-4 py-3 outline-none focus:border-[#D96B43] resize-none" />
      </Card>
      <Card title="Required agreements">
        <div className="space-y-3">
          {s.agreements.map((a, i) => (
            <textarea key={i} data-testid={`agreement-${i}`} rows={2} value={a} onChange={(e) => setAgreement(i, e.target.value)}
              className="w-full rounded-xl border border-[#E5E0D8] px-4 py-2.5 text-sm outline-none focus:border-[#D96B43] resize-none" />
          ))}
        </div>
      </Card>
      <button data-testid="save-terms-btn" disabled={saving} onClick={() => save({ terms: s.terms, cancellation_policy: s.cancellation_policy, agreements: s.agreements })}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#D96B43] text-white font-semibold disabled:opacity-50">
        {saving && <Loader2 size={16} className="animate-spin" />} Save changes
      </button>
    </>
  );
}

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CalendarCheck, Loader2, MapPin, Calendar, Clock, Plus, RefreshCw, X } from "lucide-react";
import NavigationHeader from "@/components/NavigationHeader";
import { useAuth } from "@/context/AuthContext";
import api, { apiError } from "@/lib/api";

function hourLabel(h) { if (h == null) return ""; const s = h < 12 ? "AM" : "PM"; let d = h % 12; if (d === 0) d = 12; return `${d}:00 ${s}`; }
function todayStr() { return new Date().toISOString().slice(0, 10); }

export default function MyBookings() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState(null);
  const [resB, setResB] = useState(null);
  const [rDate, setRDate] = useState("");
  const [rAvail, setRAvail] = useState(null);
  const [rStart, setRStart] = useState(null);
  const [rSaving, setRSaving] = useState(false);

  const dur = resB?.total_hours || 0;

  useEffect(() => {
    if (!resB || !rDate || resB.rental_type !== "hourly") { setRAvail(null); return; }
    setRStart(null);
    api.get(`/availability?date=${rDate}`).then((r) => setRAvail(r.data)).catch(() => setRAvail(null));
  }, [rDate, resB]);

  const validStart = (s) => {
    if (!rAvail || rAvail.day_blocked) return false;
    if (s < rAvail.open || s + dur > rAvail.close) return false;
    for (const st of resB.stalls) {
      if (rAvail.stalls[st]?.unavailable) return false;
      for (let h = s; h < s + dur; h++) {
        for (const bk of rAvail.stalls[st]?.booked || []) if (h >= bk.start && h < bk.end) return false;
      }
    }
    return true;
  };

  const startOptions = () => {
    if (!rAvail) return [];
    const arr = [];
    for (let s = rAvail.open; s + dur <= rAvail.close; s++) arr.push(s);
    return arr;
  };

  const submitReschedule = async () => {
    if (!rDate) { toast.error("Pick a date"); return; }
    const body = { date: rDate };
    if (resB.rental_type === "hourly") {
      if (rStart === null) { toast.error("Pick an available start time"); return; }
      body.start_hour = rStart; body.end_hour = rStart + dur;
    }
    setRSaving(true);
    try {
      await api.post(`/my/bookings/${resB.id}/reschedule`, body);
      toast.success("Booking rescheduled");
      setResB(null);
      const r = await api.get("/my/bookings"); setBookings(r.data);
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setRSaving(false); }
  };

  useEffect(() => { if (ready && (!user || user.role !== "user")) navigate("/login", { replace: true }); }, [ready, user, navigate]);

  useEffect(() => {
    if (ready && user && user.role === "user") {
      api.get("/my/bookings").then((r) => setBookings(r.data)).catch(() => setBookings([]));
    }
  }, [ready, user]);

  const badge = (st) => st === "confirmed" ? "bg-[#10B981]/15 text-[#10B981]" : st === "cancelled" ? "bg-[#EF4444]/15 text-[#EF4444]" : "bg-[#F59E0B]/15 text-[#B45309]";

  return (
    <div className="min-h-screen bg-[#FBF9F5]">
      <NavigationHeader />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-28 pb-16">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold text-[#1C2120] flex items-center gap-3"><CalendarCheck className="text-[#D96B43]" /> My Bookings</h1>
            <p className="text-[#6B7280] mt-1">Welcome{user?.name ? `, ${user.name}` : ""}. Here are your reservations.</p>
          </div>
          <button data-testid="new-booking-btn" onClick={() => navigate("/book")}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[#D96B43] hover:bg-[#C25933] text-white font-semibold text-sm shadow-md">
            <Plus size={16} /> New Booking
          </button>
        </div>

        {bookings === null ? (
          <div className="mt-16 grid place-items-center"><Loader2 className="animate-spin text-[#D96B43]" /></div>
        ) : bookings.length === 0 ? (
          <div className="mt-10 bg-white rounded-2xl border border-[#E5E0D8] p-10 text-center">
            <p className="text-[#6B7280]">You don't have any bookings yet.</p>
            <button onClick={() => navigate("/book")} className="mt-4 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#D96B43] text-white font-semibold text-sm">Book a stall</button>
          </div>
        ) : (
          <div className="mt-8 grid sm:grid-cols-2 gap-5" data-testid="my-bookings-list">
            {bookings.map((b) => (
              <div key={b.id} className="bg-white rounded-2xl border border-[#E5E0D8] p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-[#D96B43]">{b.confirmation_code}</span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${badge(b.status)}`}>{b.status}</span>
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-[#1C2120]"><MapPin size={15} className="text-[#D96B43]" /> Stall {b.stalls?.join(" + ")}</div>
                  <div className="flex items-center gap-2 text-[#1C2120]"><Calendar size={15} className="text-[#D96B43]" /> {b.dates?.length > 1 ? `${b.dates[0]} → ${b.dates[b.dates.length - 1]}` : b.date}</div>
                  {b.rental_type === "hourly" && <div className="flex items-center gap-2 text-[#1C2120]"><Clock size={15} className="text-[#D96B43]" /> {hourLabel(b.start_hour)} – {hourLabel(b.end_hour)}</div>}
                  <div className="text-[#6B7280]">{b.rental_label}</div>
                </div>
                <div className="mt-4 pt-4 border-t border-[#E5E0D8] flex items-center justify-between">
                  <span className="font-heading text-lg font-bold text-[#D96B43]">${b.total?.toFixed(2)}</span>
                  <div className="flex items-center gap-3">
                    {b.status !== "cancelled" && (
                      <button data-testid={`reschedule-${b.confirmation_code}`} onClick={() => { setResB(b); setRDate(""); setRAvail(null); setRStart(null); }}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#5C6B57] hover:text-[#D96B43]"><RefreshCw size={14} /> Reschedule</button>
                    )}
                    <button onClick={() => navigate(`/confirmation/${b.id}`)} className="text-sm font-semibold text-[#2C3531] hover:text-[#D96B43]">Details →</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {resB && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 backdrop-blur-sm px-4" data-testid="reschedule-modal">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-xl font-semibold text-[#1C2120]">Reschedule booking</h3>
              <button data-testid="reschedule-close" onClick={() => setResB(null)} className="text-[#6B7280] hover:text-[#1C2120]"><X size={20} /></button>
            </div>
            <p className="mt-1 text-sm text-[#6B7280]">{resB.confirmation_code} · Stall {resB.stalls?.join(" + ")} · {resB.rental_label}
              {resB.rental_type === "hourly" && ` · keep ${dur}h duration`}</p>

            <div className="mt-5">
              <label className="text-sm font-medium text-[#2C3531]">New {resB.rental_type?.startsWith("weekly") ? "week (pick any day in it)" : "date"}</label>
              <input data-testid="reschedule-date" type="date" min={todayStr()} value={rDate} onChange={(e) => setRDate(e.target.value)}
                className="mt-2 block w-full rounded-xl border border-[#E5E0D8] px-4 py-3 outline-none focus:border-[#D96B43]" />
            </div>

            {resB.rental_type === "hourly" && rDate && (
              <div className="mt-4">
                {rAvail?.day_blocked ? (
                  <p className="text-sm text-[#B45309]">That date is blocked. Choose another.</p>
                ) : (
                  <>
                    <label className="text-sm font-medium text-[#2C3531]">Available start times</label>
                    <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-52 overflow-y-auto">
                      {startOptions().map((s) => {
                        const ok = validStart(s);
                        const sel = rStart === s;
                        return (
                          <button key={s} data-testid={`reschedule-start-${s}`} disabled={!ok} onClick={() => setRStart(s)}
                            className={`py-2 rounded-lg text-xs font-medium border transition-all ${
                              sel ? "bg-[#D96B43] text-white border-[#D96B43]" :
                              ok ? "bg-[#10B981]/10 border-[#10B981]/40 text-[#1C2120] hover:bg-[#10B981]/20" :
                              "bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]/60 cursor-not-allowed line-through"}`}>
                            {hourLabel(s)}
                          </button>
                        );
                      })}
                    </div>
                    {rStart !== null && <p className="mt-2 text-sm text-[#1C2120] font-medium">New time: {hourLabel(rStart)} – {hourLabel(rStart + dur)}</p>}
                  </>
                )}
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button onClick={() => setResB(null)} className="flex-1 px-5 py-3 rounded-xl bg-white border border-[#E5E0D8] text-[#1C2120] font-semibold text-sm">Cancel</button>
              <button data-testid="reschedule-submit" onClick={submitReschedule} disabled={rSaving}
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#D96B43] hover:bg-[#C25933] text-white font-semibold text-sm disabled:opacity-50">
                {rSaving && <Loader2 size={15} className="animate-spin" />} Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarCheck, Loader2, MapPin, Calendar, Clock, Plus } from "lucide-react";
import NavigationHeader from "@/components/NavigationHeader";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

function hourLabel(h) { if (h == null) return ""; const s = h < 12 ? "AM" : "PM"; let d = h % 12; if (d === 0) d = 12; return `${d}:00 ${s}`; }

export default function MyBookings() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState(null);

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
                  <button onClick={() => navigate(`/confirmation/${b.id}`)} className="text-sm font-semibold text-[#2C3531] hover:text-[#D96B43]">View details →</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

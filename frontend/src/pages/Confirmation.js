import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { CheckCircle2, Store, Download, Calendar, Clock, MapPin, Loader2 } from "lucide-react";
import api from "@/lib/api";

function hourLabel(h) {
  if (h == null) return "";
  const s = h < 12 ? "AM" : "PM"; let d = h % 12; if (d === 0) d = 12; return `${d}:00 ${s}`;
}

export default function Confirmation() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [b, setB] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/bookings/${id}`).then((r) => setB(r.data)).catch(() => setB(null)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin text-[#D96B43]" /></div>;
  if (!b) return <div className="min-h-screen grid place-items-center text-[#6B7280]">Booking not found.</div>;

  const dateStr = b.dates?.length > 1 ? `${b.dates[0]} → ${b.dates[b.dates.length - 1]}` : b.date;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(b.confirmation_code)}`;

  return (
    <div className="min-h-screen bg-[#FBF9F5] py-12 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center animate-fadeUp">
          <span className="inline-grid place-items-center w-16 h-16 rounded-full bg-[#10B981]/15 text-[#10B981] mb-4"><CheckCircle2 size={36} /></span>
          <h1 className="font-heading text-3xl font-bold text-[#1C2120]" data-testid="confirmation-title">Reservation Confirmed</h1>
          <p className="mt-2 text-[#6B7280]">A confirmation email with your booking details is on its way.</p>
        </div>

        <div className="mt-8 bg-white rounded-2xl border border-[#E5E0D8] shadow-sm overflow-hidden animate-fadeUp">
          <div className="bg-[#D96B43] px-6 py-5 flex items-center justify-between">
            <div className="text-white">
              <div className="text-xs uppercase tracking-widest opacity-80">Confirmation code</div>
              <div className="font-mono text-2xl font-bold" data-testid="confirmation-code">{b.confirmation_code}</div>
            </div>
            <span className="grid place-items-center w-11 h-11 rounded-xl bg-white/15 text-white"><Store size={22} /></span>
          </div>

          <div className="p-6 flex gap-5">
            <img src={qr} alt="Check-in QR" className="w-[110px] h-[110px] rounded-lg border border-[#E5E0D8]" />
            <div className="flex-1 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-[#1C2120]"><MapPin size={15} className="text-[#D96B43]" /> Stall {b.stalls.join(" + ")}</div>
              <div className="flex items-center gap-2 text-[#1C2120]"><Calendar size={15} className="text-[#D96B43]" /> {dateStr}</div>
              {b.rental_type === "hourly" && <div className="flex items-center gap-2 text-[#1C2120]"><Clock size={15} className="text-[#D96B43]" /> {hourLabel(b.start_hour)} – {hourLabel(b.end_hour)}</div>}
              <div className="text-[#6B7280]">{b.rental_label}</div>
            </div>
          </div>

          <div className="px-6 pb-6 space-y-2 text-sm border-t border-[#E5E0D8] pt-4">
            <RowC k="Vendor" v={b.customer.full_name} />
            <RowC k="Business" v={b.customer.business_name} />
            <RowC k="Email" v={b.customer.email} />
            <div className="flex items-center justify-between pt-2 border-t border-[#E5E0D8] mt-2">
              <span className="font-heading font-semibold text-[#1C2120]">Total paid</span>
              <span className="font-heading text-xl font-bold text-[#D96B43]">${b.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button data-testid="print-btn" onClick={() => window.print()} className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[#2C3531] text-white font-semibold text-sm">
            <Download size={16} /> Print Receipt
          </button>
          <button data-testid="home-btn" onClick={() => navigate("/")} className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-white border border-[#E5E0D8] text-[#1C2120] font-semibold text-sm">
            Back Home
          </button>
        </div>
        <p className="mt-6 text-center text-xs text-[#6B7280]">Equipment and special setup requests remain subject to review. We'll contact you if anything needs adjusting.</p>
      </div>
    </div>
  );
}

function RowC({ k, v }) {
  return <div className="flex items-center justify-between"><span className="text-[#6B7280]">{k}</span><span className="font-medium text-[#1C2120]">{v}</span></div>;
}

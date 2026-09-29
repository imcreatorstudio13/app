import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Store, Clock, CalendarDays, User, FileCheck, CreditCard, Loader2, Upload } from "lucide-react";
import api, { apiError } from "@/lib/api";

const STEPS = [
  { id: 0, label: "Stalls", icon: Store },
  { id: 1, label: "Rental", icon: Clock },
  { id: 2, label: "Date & Time", icon: CalendarDays },
  { id: 3, label: "Your Details", icon: User },
  { id: 4, label: "Review & Terms", icon: FileCheck },
];

const FURNITURE = ["Extra table", "Clothing rack", "Artwork easel", "Display stand", "Additional chair", "Freestanding sign", "Other"];

function hourLabel(h) {
  const s = h < 12 ? "AM" : "PM";
  let d = h % 12; if (d === 0) d = 12;
  return `${d}:00 ${s}`;
}
function todayStr() { return new Date().toISOString().slice(0, 10); }
function mondayOf(dstr) {
  const d = new Date(dstr + "T00:00:00");
  const day = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

export default function Booking() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(null);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // selections
  const [count, setCount] = useState(1);
  const [stalls, setStalls] = useState([]);
  const [rentalType, setRentalType] = useState("");
  const [date, setDate] = useState("");
  const [avail, setAvail] = useState(null);
  const [startHour, setStartHour] = useState(null);
  const [endHour, setEndHour] = useState(null);

  const [cust, setCust] = useState({ full_name: "", business_name: "", email: "", phone: "", business_description: "", products: "", notes: "" });
  const [logo, setLogo] = useState(null);
  const [elecNeeded, setElecNeeded] = useState(false);
  const [elecItems, setElecItems] = useState("");
  const [furnNeeded, setFurnNeeded] = useState(false);
  const [furnItems, setFurnItems] = useState([]);
  const [furnDesc, setFurnDesc] = useState("");
  const [addInfo, setAddInfo] = useState("");

  const [agreeChecks, setAgreeChecks] = useState({});
  const [cancelAgree, setCancelAgree] = useState(false);
  const [termsAgree, setTermsAgree] = useState(false);
  const [quote, setQuote] = useState(null);

  useEffect(() => { api.get("/settings").then((r) => setSettings(r.data)).catch(() => {}); }, []);

  const singleOptions = ["A", "B", "C", "D"];
  const comboOptions = [["A", "B"], ["C", "D"]];

  // fetch availability when date changes
  useEffect(() => {
    if (!date) return;
    api.get(`/availability?date=${date}`).then((r) => setAvail(r.data)).catch(() => setAvail(null));
    setStartHour(null); setEndHour(null);
  }, [date]);

  const selectedStallsBooked = useMemo(() => {
    if (!avail) return [];
    const merged = [];
    stalls.forEach((s) => (avail.stalls[s]?.booked || []).forEach((b) => merged.push(b)));
    return merged;
  }, [avail, stalls]);

  const hourAvailable = (h) => {
    if (!avail) return false;
    if (avail.day_blocked) return false;
    for (const s of stalls) {
      if (avail.stalls[s]?.unavailable) return false;
      for (const b of avail.stalls[s]?.booked || []) {
        if (h >= b.start && h < b.end) return false;
      }
    }
    return true;
  };

  const rangeAvailable = (a, b) => {
    for (let h = a; h < b; h++) if (!hourAvailable(h)) return false;
    return true;
  };

  const clickHour = (h) => {
    if (!hourAvailable(h)) return;
    // no start yet, or clicking before current start → begin a new selection here
    if (startHour === null || h < startHour) {
      setStartHour(h); setEndHour(h + 1); return;
    }
    // clicking at/after start → extend to h+1 if the whole span is available
    if (rangeAvailable(startHour, h + 1)) {
      setEndHour(h + 1);
    } else {
      setStartHour(h); setEndHour(h + 1);
    }
  };

  const hours = useMemo(() => {
    if (!avail) return [];
    const arr = [];
    for (let h = avail.open; h < avail.close; h++) arr.push(h);
    return arr;
  }, [avail]);

  const totalHours = rentalType === "hourly" && startHour !== null && endHour !== null ? endHour - startHour : null;

  const canNext = () => {
    if (step === 0) return stalls.length === count;
    if (step === 1) return !!rentalType;
    if (step === 2) {
      if (!date) return false;
      if (rentalType === "hourly") return startHour !== null && endHour !== null && endHour - startHour >= (settings?.min_hours || 4);
      return true;
    }
    if (step === 3) return cust.full_name && cust.business_name && cust.email && cust.phone && cust.business_description && cust.products;
    return true;
  };

  const allAgreed = settings ? (settings.agreements || []).every((_, i) => agreeChecks[i]) && cancelAgree && termsAgree : false;

  const fetchQuote = async () => {
    try {
      const { data } = await api.post("/quote", {
        stalls, rental_type: rentalType, date, start_hour: startHour, end_hour: endHour,
      });
      setQuote(data);
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };

  const next = async () => {
    if (!canNext()) { toast.error("Please complete this step to continue."); return; }
    if (step === 3) await fetchQuote();
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const onLogo = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) { toast.error("Logo must be under 4MB."); return; }
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result);
    reader.readAsDataURL(f);
  };

  const submit = async () => {
    if (!allAgreed) { toast.error("You must accept all required agreements."); return; }
    setSubmitting(true);
    try {
      const payload = {
        stalls, rental_type: rentalType, date, start_hour: startHour, end_hour: endHour,
        customer: cust, logo_base64: logo,
        electrical_needed: elecNeeded, electrical_items: elecItems,
        furniture_needed: furnNeeded, furniture_items: furnItems, furniture_description: furnDesc,
        additional_info: addInfo,
        agreements_accepted: true, cancellation_accepted: cancelAgree, terms_accepted: termsAgree,
      };
      const { data: booking } = await api.post("/bookings", payload);
      const { data: checkout } = await api.post("/payments/checkout", {
        booking_id: booking.id, origin_url: window.location.origin,
      });
      window.location.href = checkout.checkout_url;
    } catch (e) {
      toast.error(apiError(e.response?.data?.detail));
      setSubmitting(false);
    }
  };

  if (!settings) return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin text-[#D96B43]" /></div>;

  return (
    <div className="min-h-screen bg-[#FBF9F5]">
      {/* top bar */}
      <div className="bg-[#14171A] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <button data-testid="booking-home-btn" onClick={() => navigate("/")} className="flex items-center gap-2 text-sm text-white/70 hover:text-white">
            <ArrowLeft size={16} /> Home
          </button>
          <span className="flex items-center gap-2 font-heading font-semibold"><Store size={18} className="text-[#D96B43]" /> Studio Market 41</span>
        </div>
      </div>

      {/* stepper */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex-1 flex items-center">
              <div className="flex flex-col items-center gap-2">
                <span className={`grid place-items-center w-10 h-10 rounded-full text-sm font-semibold transition-all ${
                  i < step ? "bg-[#5C6B57] text-white" : i === step ? "bg-[#D96B43] text-white ring-4 ring-[#D96B43]/20" : "bg-white border border-[#E5E0D8] text-[#6B7280]"}`}>
                  {i < step ? <Check size={16} /> : <s.icon size={16} />}
                </span>
                <span className={`text-[11px] font-medium hidden sm:block ${i === step ? "text-[#D96B43]" : "text-[#6B7280]"}`}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-2 ${i < step ? "bg-[#5C6B57]" : "bg-[#E5E0D8]"}`} />}
            </div>
          ))}
        </div>
      </div>

      <motion.div key={step} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white rounded-2xl border border-[#E5E0D8] shadow-sm p-6 sm:p-8">

          {/* STEP 0 STALLS */}
          {step === 0 && (
            <div data-testid="step-stalls">
              <h2 className="font-heading text-2xl font-semibold text-[#1C2120]">How many stalls?</h2>
              <p className="text-[#6B7280] mt-1">Reserve one stall, or two adjoining stalls (A + B or C + D). Max two per day.</p>
              <div className="mt-6 grid grid-cols-2 gap-4">
                {[1, 2].map((c) => (
                  <button key={c} data-testid={`count-${c}`} onClick={() => { setCount(c); setStalls([]); }}
                    className={`p-5 rounded-xl border-2 text-left transition-all ${count === c ? "border-[#D96B43] bg-[#D96B43]/5" : "border-[#E5E0D8] hover:border-[#D96B43]/50"}`}>
                    <div className="font-heading text-lg font-semibold text-[#1C2120]">{c === 1 ? "One stall" : "Two adjoining stalls"}</div>
                    <div className="text-sm text-[#6B7280]">{c === 1 ? "A, B, C, or D" : "A + B or C + D"}</div>
                  </button>
                ))}
              </div>

              <h3 className="mt-8 font-heading text-lg font-semibold text-[#1C2120]">Select your {count === 1 ? "stall" : "combination"}</h3>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                {count === 1 ? singleOptions.map((s) => (
                  <button key={s} data-testid={`stall-${s}`} onClick={() => setStalls([s])}
                    className={`aspect-square rounded-2xl border-2 grid place-items-center transition-all ${stalls[0] === s ? "border-[#D96B43] bg-[#D96B43] text-white" : "border-[#E5E0D8] hover:border-[#D96B43]/50 text-[#1C2120]"}`}>
                    <span className="font-heading text-3xl font-bold">{s}</span>
                  </button>
                )) : comboOptions.map((combo) => {
                  const active = stalls.join("") === combo.join("");
                  return (
                    <button key={combo.join("")} data-testid={`combo-${combo.join("")}`} onClick={() => setStalls(combo)}
                      className={`col-span-2 p-6 rounded-2xl border-2 flex items-center justify-center gap-3 transition-all ${active ? "border-[#D96B43] bg-[#D96B43] text-white" : "border-[#E5E0D8] hover:border-[#D96B43]/50 text-[#1C2120]"}`}>
                      <span className="font-heading text-2xl font-bold">{combo[0]}</span>
                      <span className="opacity-60">+</span>
                      <span className="font-heading text-2xl font-bold">{combo[1]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 1 RENTAL */}
          {step === 1 && (
            <div data-testid="step-rental">
              <h2 className="font-heading text-2xl font-semibold text-[#1C2120]">Choose your rental type</h2>
              <p className="text-[#6B7280] mt-1">Prices shown are per stall{stalls.length === 2 ? " — you selected two stalls" : ""}.</p>
              <div className="mt-6 space-y-4">
                {[
                  { id: "hourly", t: "Hourly / Individual-Day", p: `$${settings.hourly_rate}/hour`, d: "Minimum 4 consecutive hours. Book longer if available." },
                  { id: "daily", t: "Daily Rate", p: `$${settings.daily_rate}/day`, d: "Full operating hours for a single day." },
                  { id: "weekly_mf", t: "Weekly (Monday–Friday)", p: `$${settings.weekly_mf_rate}/week`, d: "Grand opening special. Full week, weekdays only." },
                  { id: "weekly_msun", t: "Weekly (Monday–Sunday)", p: `$${settings.weekly_msun_rate}/week`, d: "Full week including Saturday & Sunday." },
                ].map((r) => (
                  <button key={r.id} data-testid={`rental-${r.id}`} onClick={() => { setRentalType(r.id); setStartHour(null); setEndHour(null); }}
                    className={`w-full p-5 rounded-xl border-2 flex items-center justify-between text-left transition-all ${rentalType === r.id ? "border-[#D96B43] bg-[#D96B43]/5" : "border-[#E5E0D8] hover:border-[#D96B43]/50"}`}>
                    <div>
                      <div className="font-heading text-lg font-semibold text-[#1C2120]">{r.t}</div>
                      <div className="text-sm text-[#6B7280]">{r.d}</div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <div className="font-heading text-xl font-bold text-[#D96B43]">{r.p}</div>
                      {stalls.length === 2 && <div className="text-xs text-[#6B7280]">×2 stalls</div>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2 DATE & TIME */}
          {step === 2 && (
            <div data-testid="step-datetime">
              <h2 className="font-heading text-2xl font-semibold text-[#1C2120]">Pick your date{rentalType === "hourly" ? " & time" : ""}</h2>
              <p className="text-[#6B7280] mt-1">
                {rentalType?.startsWith("weekly") ? "Choose any date in the week you want — we'll reserve the full week." : "Mon–Fri 7 AM–9 PM · Sat–Sun 7 AM–10 PM"}
              </p>

              <div className="mt-5">
                <label className="text-sm font-medium text-[#2C3531]">Reservation date</label>
                <input data-testid="date-input" type="date" min={todayStr()} value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-2 block w-full sm:w-64 rounded-xl border border-[#E5E0D8] px-4 py-3 focus:border-[#D96B43] focus:ring-2 focus:ring-[#D96B43]/20 outline-none" />
                {rentalType?.startsWith("weekly") && date && (
                  <p className="mt-2 text-sm text-[#5C6B57]">Week starting Monday {mondayOf(date)}.</p>
                )}
              </div>

              {date && avail?.day_blocked && (
                <div className="mt-4 p-4 rounded-xl bg-[#F59E0B]/10 text-[#B45309] text-sm">This date is blocked and unavailable for booking. Please choose another date.</div>
              )}

              {date && rentalType === "hourly" && avail && !avail.day_blocked && (
                <div className="mt-6">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="font-heading font-semibold text-[#1C2120]">Available times for Stall {stalls.join(" + ")}</h3>
                    <div className="flex items-center gap-4 text-xs text-[#6B7280]">
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#10B981]/20 border border-[#10B981]" /> Available</span>
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#D96B43]" /> Selected</span>
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#EF4444]/20 border border-[#EF4444]" /> Booked</span>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {hours.map((h) => {
                      const available = hourAvailable(h);
                      const selected = startHour !== null && endHour !== null && h >= startHour && h < endHour;
                      return (
                        <button key={h} data-testid={`slot-${h}`} disabled={!available} onClick={() => clickHour(h)}
                          className={`py-2.5 rounded-lg text-sm font-medium border transition-all ${
                            selected ? "bg-[#D96B43] text-white border-[#D96B43]" :
                            available ? "bg-[#10B981]/10 border-[#10B981]/40 text-[#1C2120] hover:bg-[#10B981]/20" :
                            "bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]/70 cursor-not-allowed line-through"}`}>
                          {hourLabel(h)}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-sm text-[#6B7280]">
                    Tap a start time, then a later time to extend. Minimum {settings.min_hours} hours.
                    {totalHours !== null && <span className="ml-2 font-semibold text-[#1C2120]">Selected: {hourLabel(startHour)} – {hourLabel(endHour)} ({totalHours}h)</span>}
                  </p>
                  {totalHours !== null && totalHours < settings.min_hours && (
                    <p className="mt-1 text-sm text-[#EF4444]">Minimum booking is {settings.min_hours} consecutive hours.</p>
                  )}
                </div>
              )}

              {date && rentalType !== "hourly" && avail && !avail.day_blocked && (
                <div className="mt-6 p-4 rounded-xl bg-[#5C6B57]/10 text-[#2C3531] text-sm">
                  Your reservation covers the full operating hours for the selected {rentalType === "daily" ? "day" : "week"}. Availability will be verified at checkout.
                </div>
              )}
            </div>
          )}

          {/* STEP 3 DETAILS */}
          {step === 3 && (
            <div data-testid="step-details" className="space-y-6">
              <div>
                <h2 className="font-heading text-2xl font-semibold text-[#1C2120]">Your details</h2>
                <p className="text-[#6B7280] mt-1">Fields marked * are required.</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Full Name *" testid="fld-name" value={cust.full_name} onChange={(v) => setCust({ ...cust, full_name: v })} />
                <Field label="Business Name *" testid="fld-business" value={cust.business_name} onChange={(v) => setCust({ ...cust, business_name: v })} />
                <Field label="Email Address *" testid="fld-email" type="email" value={cust.email} onChange={(v) => setCust({ ...cust, email: v })} />
                <Field label="Cell Phone Number *" testid="fld-phone" value={cust.phone} onChange={(v) => setCust({ ...cust, phone: v })} />
              </div>
              <Area label="Short description of your business *" testid="fld-desc" value={cust.business_description} onChange={(v) => setCust({ ...cust, business_description: v })} />
              <Area label="What products or services will you offer? *" testid="fld-products" value={cust.products} onChange={(v) => setCust({ ...cust, products: v })} />

              <div>
                <label className="text-sm font-medium text-[#2C3531]">Business Logo (optional) — JPG, PNG, or PDF</label>
                <label className="mt-2 flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-[#E5E0D8] cursor-pointer hover:border-[#D96B43] w-fit">
                  <Upload size={16} className="text-[#D96B43]" />
                  <span className="text-sm text-[#6B7280]">{logo ? "Logo attached" : "Upload logo"}</span>
                  <input data-testid="fld-logo" type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={onLogo} />
                </label>
              </div>

              <div className="border-t border-[#E5E0D8] pt-5">
                <label className="text-sm font-medium text-[#2C3531]">Will you need an electrical outlet? *</label>
                <div className="mt-2 flex gap-3">
                  {[["No", false], ["Yes", true]].map(([l, v]) => (
                    <button key={l} data-testid={`elec-${l.toLowerCase()}`} onClick={() => setElecNeeded(v)}
                      className={`px-5 py-2 rounded-full text-sm font-medium border ${elecNeeded === v ? "bg-[#D96B43] text-white border-[#D96B43]" : "border-[#E5E0D8] text-[#2C3531]"}`}>{l}</button>
                  ))}
                </div>
                {elecNeeded && <Area label="List every electrical item and its purpose *" testid="fld-elec" value={elecItems} onChange={setElecItems} />}
              </div>

              <div className="border-t border-[#E5E0D8] pt-5">
                <label className="text-sm font-medium text-[#2C3531]">Need furniture/displays beyond what's provided? *</label>
                <div className="mt-2 flex gap-3">
                  {[["No", false], ["Yes", true]].map(([l, v]) => (
                    <button key={l} data-testid={`furn-${l.toLowerCase()}`} onClick={() => setFurnNeeded(v)}
                      className={`px-5 py-2 rounded-full text-sm font-medium border ${furnNeeded === v ? "bg-[#D96B43] text-white border-[#D96B43]" : "border-[#E5E0D8] text-[#2C3531]"}`}>{l}</button>
                  ))}
                </div>
                {furnNeeded && (
                  <div className="mt-3">
                    <div className="flex flex-wrap gap-2">
                      {FURNITURE.map((f) => {
                        const on = furnItems.includes(f);
                        return (
                          <button key={f} onClick={() => setFurnItems(on ? furnItems.filter((x) => x !== f) : [...furnItems, f])}
                            className={`px-3 py-1.5 rounded-full text-sm border ${on ? "bg-[#5C6B57] text-white border-[#5C6B57]" : "border-[#E5E0D8] text-[#2C3531]"}`}>{f}</button>
                        );
                      })}
                    </div>
                    <Area label="Describe each item and its approximate size *" testid="fld-furn-desc" value={furnDesc} onChange={setFurnDesc} />
                  </div>
                )}
              </div>

              <Area label="Anything else we should know? (optional)" testid="fld-addinfo" value={addInfo} onChange={setAddInfo} />
            </div>
          )}

          {/* STEP 4 REVIEW & TERMS */}
          {step === 4 && (
            <div data-testid="step-review" className="space-y-6">
              <h2 className="font-heading text-2xl font-semibold text-[#1C2120]">Review & accept</h2>

              <div className="rounded-xl border border-[#E5E0D8] overflow-hidden">
                <div className="bg-[#FBF9F5] px-5 py-3 font-heading font-semibold text-[#1C2120]">Booking summary</div>
                <div className="p-5 space-y-2 text-sm">
                  <Row k="Stall(s)" v={stalls.join(" + ")} />
                  <Row k="Rental type" v={settings.rental_labels?.[rentalType] || rentalType} />
                  <Row k="Date" v={rentalType?.startsWith("weekly") ? `Week of ${mondayOf(date)}` : date} />
                  {rentalType === "hourly" && <Row k="Time" v={`${hourLabel(startHour)} – ${hourLabel(endHour)}`} />}
                  {rentalType === "hourly" && <Row k="Total hours" v={`${totalHours}h`} />}
                  <div className="border-t border-[#E5E0D8] pt-2 mt-2 flex items-center justify-between">
                    <span className="font-heading text-lg font-semibold text-[#1C2120]">Total</span>
                    <span className="font-heading text-2xl font-bold text-[#D96B43]" data-testid="review-total">${quote ? quote.total.toFixed(2) : "—"}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[#E5E0D8] p-5">
                <h3 className="font-heading font-semibold text-[#1C2120]">Required agreements</h3>
                <div className="mt-3 space-y-3 max-h-64 overflow-y-auto pr-1">
                  {(settings.agreements || []).map((a, i) => (
                    <label key={i} data-testid={`agree-${i}`} className="flex items-start gap-3 text-sm text-[#2C3531] cursor-pointer">
                      <input type="checkbox" checked={!!agreeChecks[i]} onChange={(e) => setAgreeChecks({ ...agreeChecks, [i]: e.target.checked })}
                        className="mt-1 w-4 h-4 accent-[#D96B43]" />
                      <span>{a}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-[#E5E0D8] p-5">
                <h3 className="font-heading font-semibold text-[#1C2120]">Cancellation & refund policy</h3>
                <p className="mt-2 text-sm text-[#6B7280] leading-relaxed">{settings.cancellation_policy}</p>
                <label data-testid="agree-cancel" className="mt-3 flex items-start gap-3 text-sm text-[#2C3531] cursor-pointer">
                  <input type="checkbox" checked={cancelAgree} onChange={(e) => setCancelAgree(e.target.checked)} className="mt-1 w-4 h-4 accent-[#D96B43]" />
                  <span>I have reviewed and agree to the cancellation and refund policy.</span>
                </label>
              </div>

              <div className="rounded-xl border border-[#E5E0D8] p-5">
                <h3 className="font-heading font-semibold text-[#1C2120]">Booking terms</h3>
                <p className="mt-2 text-sm text-[#6B7280] leading-relaxed">{settings.terms}</p>
                <label data-testid="agree-terms" className="mt-3 flex items-start gap-3 text-sm text-[#2C3531] cursor-pointer">
                  <input type="checkbox" checked={termsAgree} onChange={(e) => setTermsAgree(e.target.checked)} className="mt-1 w-4 h-4 accent-[#D96B43]" />
                  <span>I agree to the Studio Market 41 vendor rules and booking terms.</span>
                </label>
              </div>
            </div>
          )}

          {/* nav buttons */}
          <div className="mt-8 flex items-center justify-between">
            <button data-testid="back-btn" onClick={back} disabled={step === 0}
              className={`inline-flex items-center gap-2 px-5 py-3 rounded-full font-medium text-sm ${step === 0 ? "opacity-0 pointer-events-none" : "text-[#2C3531] hover:bg-[#FBF9F5]"}`}>
              <ArrowLeft size={16} /> Back
            </button>
            {step < STEPS.length - 1 ? (
              <button data-testid="next-btn" onClick={next}
                className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-[#D96B43] hover:bg-[#C25933] text-white font-semibold text-sm shadow-md transition-all">
                Continue <ArrowRight size={16} />
              </button>
            ) : (
              <button data-testid="pay-btn" onClick={submit} disabled={!allAgreed || submitting}
                className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-[#D96B43] hover:bg-[#C25933] disabled:opacity-50 text-white font-semibold text-sm shadow-md transition-all">
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                {submitting ? "Redirecting…" : `Pay $${quote ? quote.total.toFixed(2) : ""}`}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", testid }) {
  return (
    <div>
      <label className="text-sm font-medium text-[#2C3531]">{label}</label>
      <input data-testid={testid} type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-2 block w-full rounded-xl border border-[#E5E0D8] px-4 py-3 focus:border-[#D96B43] focus:ring-2 focus:ring-[#D96B43]/20 outline-none" />
    </div>
  );
}
function Area({ label, value, onChange, testid }) {
  return (
    <div className="mt-3">
      <label className="text-sm font-medium text-[#2C3531]">{label}</label>
      <textarea data-testid={testid} rows={3} value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-2 block w-full rounded-xl border border-[#E5E0D8] px-4 py-3 focus:border-[#D96B43] focus:ring-2 focus:ring-[#D96B43]/20 outline-none resize-none" />
    </div>
  );
}
function Row({ k, v }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#6B7280]">{k}</span>
      <span className="font-medium text-[#1C2120]">{v}</span>
    </div>
  );
}

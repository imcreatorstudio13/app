import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Store, Clock, Wifi, Zap, Megaphone, MapPin, ArrowRight, Check, Calendar, ShieldCheck } from "lucide-react";
import NavigationHeader from "@/components/NavigationHeader";
import api from "@/lib/api";

const HERO = "https://images.unsplash.com/photo-1759323321196-2813db509285?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600";
const STALL_IMG = "https://images.unsplash.com/photo-1651449816008-2cbdcf626b1f?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

const includes = [
  { icon: Store, t: "Your retail vendor space", d: "A dedicated, ready-to-use stall in a high-visibility boutique setting." },
  { icon: Zap, t: "Utilities & lighting", d: "General power and warm gallery lighting included in every reservation." },
  { icon: Wifi, t: "Wi-Fi access", d: "Reliable connectivity for card readers, tablets, and displays." },
  { icon: Clock, t: "Confirmed-period access", d: "Come and go freely during your booked reservation window." },
  { icon: Megaphone, t: "Social media marketing", d: "General promotion of the market across Studio Market 41 channels." },
  { icon: ShieldCheck, t: "24-hour surveillance", d: "General property security so you can focus on selling." },
];

const faqs = [
  { q: "How long is the minimum booking?", a: "Hourly and individual-day reservations require a minimum of four consecutive hours. You may book longer if the time is available." },
  { q: "Can I book more than one stall?", a: "Yes. You can reserve one stall, or two adjoining stalls — Stalls A + B, or Stalls C + D. Non-adjoining combinations are not available." },
  { q: "What are the operating hours?", a: "Monday–Friday: 7:00 AM – 9:00 PM. Saturday–Sunday: 7:00 AM – 10:00 PM." },
  { q: "What is the cancellation policy?", a: "Full refund if cancelled 48+ hours before; 70% refund if less than 48 hours; no refund for no-shows or after the reservation begins." },
];

export default function Home() {
  const navigate = useNavigate();
  const [s, setS] = useState(null);

  useEffect(() => { api.get("/settings").then((r) => setS(r.data)).catch(() => {}); }, []);

  const stalls = [
    { id: "A", label: "Stall A", size: "10 × 10 ft", note: "Adjoins B" },
    { id: "B", label: "Stall B", size: "10 × 10 ft", note: "Adjoins A" },
    { id: "C", label: "Stall C", size: "10 × 10 ft", note: "Adjoins D" },
    { id: "D", label: "Stall D", size: "10 × 10 ft", note: "Adjoins C" },
  ];

  return (
    <div className="relative overflow-hidden">
      <NavigationHeader />

      {/* HERO */}
      <section className="relative min-h-[92vh] flex items-center">
        <div className="absolute inset-0">
          <img src={HERO} alt="Studio Market 41 space" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#14171A]/90 via-[#14171A]/70 to-[#14171A]/30" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 w-full">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="max-w-2xl">
            <span className="inline-flex items-center gap-2 text-[#E5A93C] text-xs font-bold uppercase tracking-[0.25em] mb-6">
              <MapPin size={14} /> Pop-Up Retail · Book By The Hour
            </span>
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.05]">
              Reserve your space at <span className="text-[#D96B43]">Studio Market 41</span>
            </h1>
            <p className="mt-6 text-lg text-white/80 leading-relaxed max-w-xl">
              A retail home for small businesses, artists, and independent brands — sell and promote your products without the cost or commitment of a permanent storefront.
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <button data-testid="hero-book-btn" onClick={() => navigate("/book")}
                className="group inline-flex items-center gap-2 px-8 py-4 rounded-full bg-[#D96B43] hover:bg-[#C25933] text-white font-semibold text-base shadow-xl transition-all">
                Book a Stall <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button data-testid="hero-explore-btn" onClick={() => document.querySelector("#stalls")?.scrollIntoView({ behavior: "smooth" })}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-semibold text-base transition-all">
                View Stalls & Pricing
              </button>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-white/70 text-sm">
              <span className="flex items-center gap-2"><Check size={16} className="text-[#E5A93C]" /> From ${s?.hourly_rate ?? 10}/hour</span>
              <span className="flex items-center gap-2"><Check size={16} className="text-[#E5A93C]" /> 4-hour minimum</span>
              <span className="flex items-center gap-2"><Check size={16} className="text-[#E5A93C]" /> Live availability</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="relative py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-[#D96B43]">About the space</span>
            <h2 className="mt-4 font-heading text-3xl sm:text-4xl font-semibold tracking-tight text-[#1C2120]">
              A storefront, without the storefront commitment
            </h2>
            <p className="mt-5 text-[#2C3531] leading-relaxed">
              Studio Market 41 gives small businesses, artists, creators, and independent brands the opportunity to sell and promote their products in a retail environment. Choose one individual vendor stall or reserve two adjoining stalls for additional display space.
            </p>
            <ul className="mt-6 space-y-3">
              {["Individual-day reservations from $" + (s?.hourly_rate ?? 10) + " per hour",
                "Weekly Monday–Friday and full Monday–Sunday options",
                "Each business may reserve up to two stalls per day",
                "Two-stall reservations limited to adjoining spaces"].map((t) => (
                <li key={t} className="flex items-start gap-3 text-[#2C3531]">
                  <span className="mt-1 grid place-items-center w-5 h-5 rounded-full bg-[#5C6B57]/15 text-[#5C6B57]"><Check size={13} /></span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <img src={STALL_IMG} alt="Vendor stall interior" className="rounded-2xl shadow-2xl w-full h-[420px] object-cover" />
            <div className="absolute -bottom-6 -left-6 bg-white rounded-xl shadow-xl p-5 border border-[#E5E0D8] hidden sm:block">
              <div className="text-3xl font-heading font-bold text-[#D96B43]">4</div>
              <div className="text-xs uppercase tracking-widest text-[#6B7280] mt-1">Vendor stalls</div>
            </div>
          </div>
        </div>
      </section>

      {/* INCLUDES */}
      <section className="relative py-16 md:py-24 bg-[#14171A] grain">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="text-xs font-bold uppercase tracking-widest text-[#E5A93C]">What your reservation includes</span>
          <h2 className="mt-4 font-heading text-3xl sm:text-4xl font-semibold text-white max-w-2xl">Everything you need to show up and sell</h2>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {includes.map((it, i) => (
              <motion.div key={it.t} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors">
                <span className="grid place-items-center w-12 h-12 rounded-xl bg-[#D96B43] text-white mb-4"><it.icon size={22} /></span>
                <h3 className="font-heading text-lg font-semibold text-white">{it.t}</h3>
                <p className="mt-2 text-sm text-white/60 leading-relaxed">{it.d}</p>
              </motion.div>
            ))}
          </div>
          <p className="mt-8 text-xs text-white/40 max-w-xl">Marketing efforts do not guarantee a particular number of customers, sales, views, or revenue.</p>
        </div>
      </section>

      {/* STALLS & PRICING */}
      <section id="stalls" className="relative py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-widest text-[#D96B43]">Stalls & pricing</span>
            <h2 className="mt-4 font-heading text-3xl sm:text-4xl font-semibold text-[#1C2120]">Choose your space</h2>
            <p className="mt-4 text-[#6B7280]">Reserve a single stall, or combine two adjoining stalls — A + B or C + D.</p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stalls.map((st) => (
              <div key={st.id} data-testid={`stall-card-${st.id}`} className="group p-6 rounded-2xl bg-white border border-[#E5E0D8] hover:border-[#D96B43] hover:shadow-xl transition-all">
                <div className="flex items-center justify-between">
                  <span className="grid place-items-center w-14 h-14 rounded-2xl bg-[#FBF9F5] border border-[#E5E0D8] font-heading text-2xl font-bold text-[#D96B43] group-hover:bg-[#D96B43] group-hover:text-white transition-colors">{st.id}</span>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-[#5C6B57]/10 text-[#5C6B57] font-medium">{st.note}</span>
                </div>
                <h3 className="mt-5 font-heading text-lg font-semibold text-[#1C2120]">{st.label}</h3>
                <p className="text-sm text-[#6B7280]">{st.size} · Power + lighting</p>
              </div>
            ))}
          </div>

          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { t: "Hourly", p: `$${s?.hourly_rate ?? 10}`, u: "/hour", d: "4-hour consecutive minimum" },
              { t: "Daily", p: `$${s?.daily_rate ?? 70}`, u: "/day", d: "Full operating hours" },
              { t: "Weekly (Mon–Fri)", p: `$${s?.weekly_mf_rate ?? 300}`, u: "/week", d: "Grand opening special" },
              { t: "Weekly (Mon–Sun)", p: `$${s?.weekly_msun_rate ?? 400}`, u: "/week", d: "Includes weekend" },
            ].map((r) => (
              <div key={r.t} className="p-6 rounded-2xl bg-[#2C3531] text-white">
                <div className="text-xs uppercase tracking-widest text-[#E5A93C] font-semibold">{r.t}</div>
                <div className="mt-3 flex items-end gap-1">
                  <span className="font-heading text-3xl font-bold">{r.p}</span>
                  <span className="text-white/50 text-sm mb-1">{r.u}</span>
                </div>
                <p className="mt-2 text-sm text-white/60">{r.d}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <button data-testid="stalls-book-btn" onClick={() => navigate("/book")}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-[#D96B43] hover:bg-[#C25933] text-white font-semibold shadow-lg transition-all">
              <Calendar size={18} /> Check Availability & Book
            </button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative py-16 md:py-24 bg-white border-t border-[#E5E0D8]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-[#D96B43]">FAQ</span>
            <h2 className="mt-4 font-heading text-3xl sm:text-4xl font-semibold text-[#1C2120]">Good to know</h2>
          </div>
          <div className="mt-10 space-y-4">
            {faqs.map((f) => (
              <div key={f.q} className="p-6 rounded-xl bg-[#FBF9F5] border border-[#E5E0D8]">
                <h3 className="font-heading font-semibold text-[#1C2120]">{f.q}</h3>
                <p className="mt-2 text-sm text-[#6B7280] leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-[#14171A] py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid place-items-center w-9 h-9 rounded-lg bg-[#D96B43] text-white"><Store size={18} /></span>
            <span className="font-heading font-semibold text-white">Studio Market 41</span>
          </div>
          <p className="text-white/40 text-sm">© {new Date().getFullYear()} Studio Market 41. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Store, Menu, X } from "lucide-react";

const links = [
  { to: "/#about", label: "About" },
  { to: "/#stalls", label: "Stalls & Pricing" },
  { to: "/#faq", label: "FAQ" },
  { to: "/admin", label: "Admin" },
];

export default function NavigationHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const go = (to) => {
    setOpen(false);
    if (to.startsWith("/#")) {
      if (loc.pathname !== "/") { navigate("/"); setTimeout(() => { document.querySelector(to.slice(1))?.scrollIntoView({ behavior: "smooth" }); }, 120); }
      else document.querySelector(to.slice(1))?.scrollIntoView({ behavior: "smooth" });
    } else navigate(to);
  };

  return (
    <header
      data-testid="site-header"
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-[#FBF9F5]/90 backdrop-blur-xl border-b border-[#E5E0D8] shadow-sm" : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <button data-testid="logo-btn" onClick={() => go("/")} className="flex items-center gap-3 group">
            <span className="grid place-items-center w-11 h-11 rounded-xl bg-[#D96B43] text-white shadow-md group-hover:scale-105 transition-transform">
              <Store size={22} />
            </span>
            <span className="text-left leading-none">
              <span className="block font-heading font-bold text-[#1C2120] text-lg tracking-tight">Studio Market 41</span>
              <span className="block text-[10px] uppercase tracking-[0.2em] text-[#D96B43] font-semibold mt-1">Pop-Up Retail Space</span>
            </span>
          </button>

          <nav className="hidden md:flex items-center gap-8">
            {links.map((l) => (
              <button key={l.to} data-testid={`nav-${l.label.split(" ")[0].toLowerCase()}`}
                onClick={() => go(l.to)}
                className="text-sm font-medium text-[#2C3531] hover:text-[#D96B43] transition-colors">
                {l.label}
              </button>
            ))}
            <button data-testid="book-now-nav" onClick={() => go("/book")}
              className="px-5 py-2.5 rounded-full bg-[#D96B43] hover:bg-[#C25933] text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all">
              Book Now
            </button>
          </nav>

          <button data-testid="mobile-menu-btn" className="md:hidden text-[#1C2120]" onClick={() => setOpen(!open)}>
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden bg-[#FBF9F5] border-t border-[#E5E0D8] px-4 py-4 flex flex-col gap-3">
          {links.map((l) => (
            <button key={l.to} onClick={() => go(l.to)} className="text-left py-2 text-[#2C3531] font-medium">{l.label}</button>
          ))}
          <button data-testid="book-now-mobile" onClick={() => go("/book")} className="mt-1 px-5 py-3 rounded-full bg-[#D96B43] text-white font-semibold">Book Now</button>
        </div>
      )}
    </header>
  );
}

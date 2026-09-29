import React, { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Loader2, XCircle } from "lucide-react";
import api from "@/lib/api";

const MAX_POLLS = 8;

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = params.get("session_id");
  const [msg, setMsg] = useState("Confirming your payment…");
  const [failed, setFailed] = useState(false);
  const attempts = useRef(0);

  useEffect(() => {
    if (!sessionId) { setFailed(true); setMsg("Missing payment session."); return; }
    let timer;
    const poll = async () => {
      try {
        const { data } = await api.get(`/payments/status/${sessionId}`);
        if (data.payment_status === "paid") {
          navigate(`/confirmation/${data.booking.id}`, { replace: true });
          return;
        }
      } catch (e) { /* keep polling */ }
      attempts.current += 1;
      if (attempts.current >= MAX_POLLS) { setFailed(true); setMsg("We couldn't confirm your payment yet."); return; }
      timer = setTimeout(poll, 2000);
    };
    poll();
    return () => clearTimeout(timer);
  }, [sessionId, navigate]);

  return (
    <div className="min-h-screen grid place-items-center bg-[#FBF9F5] px-4">
      <div className="text-center max-w-sm" data-testid="payment-success">
        {failed ? (
          <>
            <span className="inline-grid place-items-center w-14 h-14 rounded-full bg-[#EF4444]/15 text-[#EF4444] mb-4"><XCircle size={32} /></span>
            <h1 className="font-heading text-2xl font-semibold text-[#1C2120]">{msg}</h1>
            <p className="mt-2 text-[#6B7280] text-sm">If you were charged, your confirmation email will still arrive. You can also contact us to verify.</p>
            <button onClick={() => navigate("/")} className="mt-6 px-6 py-3 rounded-full bg-[#D96B43] text-white font-semibold text-sm">Back Home</button>
          </>
        ) : (
          <>
            <Loader2 size={40} className="animate-spin text-[#D96B43] mx-auto" />
            <h1 className="mt-5 font-heading text-2xl font-semibold text-[#1C2120]">{msg}</h1>
            <p className="mt-2 text-[#6B7280] text-sm">Please don't close this window.</p>
          </>
        )}
      </div>
    </div>
  );
}

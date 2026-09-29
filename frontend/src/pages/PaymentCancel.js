import React from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { XCircle } from "lucide-react";

export default function PaymentCancel() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen grid place-items-center bg-[#FBF9F5] px-4">
      <div className="text-center max-w-sm" data-testid="payment-cancel">
        <span className="inline-grid place-items-center w-14 h-14 rounded-full bg-[#F59E0B]/15 text-[#F59E0B] mb-4"><XCircle size={32} /></span>
        <h1 className="font-heading text-2xl font-semibold text-[#1C2120]">Payment cancelled</h1>
        <p className="mt-2 text-[#6B7280] text-sm">Your reservation was not completed. The time slot has not been charged and remains open.</p>
        <div className="mt-6 flex gap-3 justify-center">
          <button onClick={() => navigate("/book")} className="px-6 py-3 rounded-full bg-[#D96B43] text-white font-semibold text-sm">Try Again</button>
          <button onClick={() => navigate("/")} className="px-6 py-3 rounded-full bg-white border border-[#E5E0D8] text-[#1C2120] font-semibold text-sm">Home</button>
        </div>
      </div>
    </div>
  );
}

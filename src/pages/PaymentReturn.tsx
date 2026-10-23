import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { CheckCircle2, Clock, CreditCard } from "lucide-react";
import { PageHead } from "@/components/StatusBadge";
import { paymentsApi } from "@/lib/api";
import { formatNGN } from "@/lib/money";

type State = { kind: "checking" } | { kind: "disabled" } | { kind: "error"; msg: string } | { kind: "done"; status: string; payment: any };

const PURPOSE_LABEL: Record<string, string> = {
  order: "Order payment",
  partner_verification: "Partner verification fee",
  partner_featured: "Partner featured placement",
  booking_deposit: "Booking deposit",
};

export default function PaymentReturn() {
  const [params] = useSearchParams();
  const reference = params.get("reference") || params.get("trxref") || "";
  const [state, setState] = useState<State>({ kind: "checking" });

  useEffect(() => {
    let on = true;
    if (!reference) { setState({ kind: "error", msg: "No payment reference in this link." }); return; }
    paymentsApi.verify(reference)
      .then(r => { if (!on) return; if (!r.enabled) setState({ kind: "disabled" }); else setState({ kind: "done", status: r.status || "unknown", payment: r.payment }); })
      .catch(e => { if (on) setState({ kind: "error", msg: String(e?.message || e) }); });
    return () => { on = false; };
  }, [reference]);

  const paid = state.kind === "done" && state.status === "paid";
  return (<div>
    <PageHead kicker="Payment" title="Payment status" lead="We confirm every online payment with Paystack before applying it — nothing is marked paid on trust." />
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12">
      {state.kind === "checking" && <div className="border hairline bg-card p-8 text-center"><Clock className="h-8 w-8 text-primary mx-auto" /><p className="font-tech text-sm mt-4">Confirming your payment with Paystack…</p><p className="font-tech text-[11px] text-muted-foreground mt-2 break-all">{reference}</p></div>}
      {state.kind === "disabled" && <div className="border hairline bg-card p-8"><p className="font-tech text-sm">Online payments are not enabled on this deployment yet. If you paid, message us on WhatsApp with your reference and we will reconcile it manually.</p></div>}
      {state.kind === "error" && <div className="border border-red-500/40 bg-red-500/5 p-8"><p className="font-tech text-sm">We could not confirm this payment: {state.msg}</p><p className="font-tech text-[11px] text-muted-foreground mt-2">If money left your account, it is still recorded with Paystack under reference <span className="break-all">{reference}</span> — contact us and we will reconcile it.</p></div>}
      {state.kind === "done" && (
        <div className="border hairline bg-card p-8">
          {paid ? <CheckCircle2 className="h-10 w-10 text-emerald-500" /> : <CreditCard className="h-10 w-10 text-primary" />}
          <h2 className="font-display font-bold uppercase text-2xl mt-4">{paid ? "Payment confirmed" : `Payment status: ${state.status}`}</h2>
          <div className="font-tech text-sm mt-4 space-y-2">
            <div className="flex justify-between border-b hairline pb-2"><span className="text-muted-foreground">For</span><span>{PURPOSE_LABEL[state.payment?.purpose] || state.payment?.purpose || "—"}</span></div>
            <div className="flex justify-between border-b hairline pb-2"><span className="text-muted-foreground">Reference</span><span className="break-all">{state.payment?.reference || reference}</span></div>
            {state.payment?.refId && <div className="flex justify-between border-b hairline pb-2"><span className="text-muted-foreground">Linked record</span><span>{state.payment.refId}</span></div>}
            {typeof state.payment?.amountKobo === "number" && <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span>{formatNGN(state.payment.amountKobo / 100)}</span></div>}
          </div>
          {paid && <p className="text-sm text-muted-foreground mt-4">{state.payment?.purpose === "order" ? "Your order is now marked paid — track it any time." : state.payment?.purpose?.startsWith("partner") ? "Your upgrade is active on your listing — check your partner dashboard." : "Thank you — the payment has been applied."}</p>}
          {!paid && <p className="text-sm text-muted-foreground mt-4">If you completed payment on Paystack, confirmation can take a moment — refresh this page shortly. Nothing is lost: the reference above identifies your payment.</p>}
          <div className="flex gap-3 mt-6 flex-wrap">
            <Link to="/track" className="bg-primary text-primary-foreground font-display font-semibold uppercase tracking-wider px-5 h-11 inline-flex items-center hover:bg-primary/90">Track order / booking</Link>
            <Link to="/partner-status" className="border hairline font-display font-semibold uppercase tracking-wider px-5 h-11 inline-flex items-center hover:text-primary">Partner dashboard</Link>
          </div>
        </div>
      )}
    </div>
  </div>);
}

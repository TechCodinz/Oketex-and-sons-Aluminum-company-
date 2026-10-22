import { NGN_PER_USD } from "@/contracts/constants";
export function formatNGN(amount: number): string { return `₦${Math.round(amount).toLocaleString("en-NG")}`; }
export function formatUSD(ngnAmount: number): string { const usd = ngnAmount / NGN_PER_USD; return `≈ $${usd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`; }

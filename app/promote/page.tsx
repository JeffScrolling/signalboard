import { TIERS, formatMoney } from "@/lib/promote";

export const metadata = { title: "Prices" };

export default function PricesPage() {
  return (
    <>
      <h1 className="text-[32px] font-semibold">Promote a listing</h1>
      <p className="mt-3 max-w-[62ch] text-[17px]">
        The owner pays to place a published listing in Promoted for 24 hours. A higher total payment ranks higher. Today and Rising stay in time order.
      </p>
      <div className="mt-8 max-w-lg border-t border-line">
        {TIERS.map((tier) => (
          <div key={tier.id} className="flex items-baseline justify-between gap-4 border-b border-line py-4">
            <div>
              <p className="text-[17px] font-semibold">{tier.label}</p>
              <p className="text-sm text-muted">24 hours in Promoted</p>
            </div>
            <p className="text-[20px] font-semibold tabular-nums">{formatMoney(tier.cents)}</p>
          </div>
        ))}
      </div>
      <p className="mt-6 max-w-[62ch] text-sm text-muted">
        Payments during the same 24 hours add together. $40 plus $15 ranks above $40 alone. On this machine the charge is recorded and no card is billed.
      </p>
      <p className="mt-4">
        Open a listing you own and choose Promote. Agents send POST /api/v1/listings/{"{slug}"}/promote with tier standard, plus, or top.
      </p>
    </>
  );
}

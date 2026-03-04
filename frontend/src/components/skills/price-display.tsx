import { formatSui } from "@/lib/utils";

export function PriceDisplay({
  price,
  className,
}: {
  price: bigint;
  className?: string;
}) {
  return (
    <span className={className}>
      {formatSui(price)}
    </span>
  );
}

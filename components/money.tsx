import { formatZar, type MoneyInput } from "@/lib/money";
import { cn } from "@/lib/utils";

export function Money({
  value,
  className,
  cents,
  sign,
  symbol = true,
}: {
  value: MoneyInput;
  className?: string;
  cents?: boolean;
  sign?: boolean;
  symbol?: boolean;
}) {
  return (
    <span className={cn("money", className)}>{formatZar(value, { cents, sign, symbol })}</span>
  );
}

/** Money already held in integer cents (everything computed in lib/money.ts). */
export function MoneyCents({
  cents,
  className,
  withCents,
  sign,
  symbol = true,
}: {
  cents: number;
  className?: string;
  withCents?: boolean;
  sign?: boolean;
  symbol?: boolean;
}) {
  return (
    <span className={cn("money", className)}>
      {formatZar(cents / 100, { cents: withCents, sign, symbol })}
    </span>
  );
}

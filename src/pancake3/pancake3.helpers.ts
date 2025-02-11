export function formatAmountForBigint(value: number | string): string {
  return Number(String(value).replace(".", ""))
    .toString()
    .slice(0, 15);
}

export function computeAmountOutMinSingleHop(
  sqrtPriceX96: string,
  slippageBps: number
): bigint {
  const price = (Number(sqrtPriceX96) / 2 ** 96) ** 2;
  const priceWithSlippage = price * (1 - slippageBps / 10_000);
  console.log(`🍰 ⓘ | Цена - ${price}, Цена со скольжением (${slippageBps}%) - ${priceWithSlippage}`);

  return BigInt(formatAmountForBigint(priceWithSlippage));
}

export const getDeadline = (mins: number): number => {
  return Math.floor(Date.now() / 1000 + 60 * mins);
};
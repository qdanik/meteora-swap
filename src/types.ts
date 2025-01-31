export type Currency = 'usdc' | 'sol';

export type IncomingTransaction = {
  poolAddress: string;
  mintX: string;
  mintY: string;
  currency: Currency;
  contractAddress: string;
  amount?: number;
};

export type MeteoraSwapOptions = {
  from: Currency;
  to: string;
  amount: number;
  slippage?: number;
  swapForY?: boolean;
};
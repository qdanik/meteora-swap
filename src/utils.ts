import { Currency, IncomingTransaction } from './types';

export const isCorrectCurrency = (currency: string): currency is Currency => {
  return currency === 'usdc' || currency === 'sol';
};

export const hasRequiredFields = (message: IncomingTransaction): message is IncomingTransaction => {
  return (
    !!message.poolAddress &&
    !!message.contractAddress &&
    !!message.nameX &&
    !!message.nameY &&
    !!message.caX &&
    !!message.caY
  );
};

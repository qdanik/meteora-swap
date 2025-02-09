import { IncomingSwapToken, IncomingTransaction } from './types';

export const hasTransactionRequiredFields = (message: IncomingTransaction): message is IncomingTransaction => {
  return (
    !!message.poolAddress &&
    !!message.contractAddress &&
    !!message.nameX &&
    !!message.nameY &&
    !!message.caX &&
    !!message.caY
  );
};

export const hasSwapTokenRequiredFields = (message: IncomingSwapToken): message is IncomingSwapToken => {
  return !!message.address;
};

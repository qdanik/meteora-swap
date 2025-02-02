import { IncomingTransaction } from './types';

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

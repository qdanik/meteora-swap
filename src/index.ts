import { mqConnection } from './rabbit';
import { createMeteora } from './meteora';
import { DEFAULT_SOL_AMOUNT, DEFAULT_USDC_AMOUNT, RMQ_NOTIFY_QUEUE, RMQ_TX_QUEUE } from './config';
import { Currency, IncomingTransaction } from './types';

const isCorrectCurrency = (currency: string): currency is Currency => {
  return currency === 'usdc' || currency === 'sol';
};

const hasRequiredFields = (message: IncomingTransaction): message is IncomingTransaction => {
  return (
    !!message.poolAddress &&
    !!message.mintX &&
    !!message.mintY &&
    !!message.currency &&
    !!message.contractAddress
  );
};

const getDefaultAmount = (currency: Currency) => {
  switch (currency) {
    case 'usdc':
      return DEFAULT_USDC_AMOUNT;
    case 'sol':
      return DEFAULT_SOL_AMOUNT;
    default:
      return 1;
  }
};

const start = async () => {
  await mqConnection.connect();
  const meteora = createMeteora();

  const handleIncomingNotification = async (msg: string) => {
    try {
      const parsedMessage = JSON.parse(msg) as IncomingTransaction;
      console.log(`📬 Received Notification: `, parsedMessage);

      if (!isCorrectCurrency(parsedMessage.currency)) {
        throw new Error(`❌ Invalid currency: ${parsedMessage.currency}`);
      }

      if (!hasRequiredFields(parsedMessage)) {
        throw new Error(`❌ Missing required fields in incoming message`);
      }

      const amount = parsedMessage.amount ?? getDefaultAmount(parsedMessage.currency);
      const swapForY = parsedMessage.contractAddress === parsedMessage.mintY;

      await meteora.swapByPool(
        parsedMessage.currency,
        parsedMessage.poolAddress,
        parsedMessage.contractAddress,
        amount,
        swapForY,
      );
      mqConnection.sendToQueue(RMQ_NOTIFY_QUEUE, {
        text: `✅ Successfully swapped ${amount} ${parsedMessage.currency} to ${swapForY ? parsedMessage.mintY : parsedMessage.mintX}`,
      });
    } catch (error) {
      console.error(`Error parsing incoming message: `, error);
    }
  };

  await mqConnection.consume(handleIncomingNotification);

  // Send a test message to the queue to SWAP USDC to SOL
  // await mqConnection.sendToQueue(RMQ_TX_QUEUE, {
  //   poolAddress: '7zwc5JuKuyhgc1VELA59KGAY2xmd3HZGwJNLCfHXZP99',
  //   contractAddress: 'So11111111111111111111111111111111111111112',
  //   currency: 'usdc',
  //   mintX: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  //   mintY: 'So11111111111111111111111111111111111111112',
  // });

  // await mqConnection.consume(console.log, RMQ_NOTIFY_QUEUE);
  // setInterval(() => {
  //   mqConnection.sendToQueue(RMQ_NOTIFY_QUEUE, {
  //     text: `✅ Successfully listened to incoming messages`,
  //   });
  // }, 15000);

  console.log(`🚀 Meteora is ready to swap`);
};

start();
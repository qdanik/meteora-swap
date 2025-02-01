import { mqConnection } from './rabbit';
import { createMeteora } from './meteora';
import { RMQ_NOTIFY_QUEUE, RMQ_TX_QUEUE } from './config';
import { IncomingTransaction } from './types';
import { hasRequiredFields } from './utils';

const start = async () => {
  await mqConnection.connect();
  const meteora = createMeteora(mqConnection);

  const handleIncomingNotification = async (msg: string) => {
    try {
      const parsedMessage = JSON.parse(msg) as IncomingTransaction;
      console.log(`📬 Received Notification: `, parsedMessage);

      if (!hasRequiredFields(parsedMessage)) {
        throw new Error(`❌ Missing required fields in incoming message`);
      }
      const buyYForX = parsedMessage.contractAddress === parsedMessage.caX;

      const {
        txHash,
        inAmount,
        inName,
        outName,
      } = await meteora.swap(
        parsedMessage.poolAddress,
        parsedMessage.nameX,
        parsedMessage.nameY,
        parsedMessage.caX,
        parsedMessage.caY,
        undefined, // default amount will be handled by the swap function
        buyYForX,
      );
      mqConnection.sendToQueue(RMQ_NOTIFY_QUEUE, {
        text: `✅ Successfully Swapped ${inAmount} ${inName.toUpperCase()} to ${outName.toUpperCase()}.\n Transaction Hash: ${txHash}`,
      });
    } catch (error) {
      console.error(`❌ Could not handle incoming notification: ${error.message}`);

      mqConnection.sendToQueue(RMQ_NOTIFY_QUEUE, {
        text: `❌ Could not handle transaction: ${msg}`,
      });
    }
  };

  await mqConnection.consume(handleIncomingNotification);

  // Send a test message to the queue to SWAP USDC to SOL
  // await mqConnection.sendToQueue(RMQ_TX_QUEUE, {
  //   poolAddress: '7zwc5JuKuyhgc1VELA59KGAY2xmd3HZGwJNLCfHXZP99',
  //   contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  //   nameX: 'USDC',
  //   nameY: 'SOL',
  //   caX: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  //   caY: 'So11111111111111111111111111111111111111112',
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
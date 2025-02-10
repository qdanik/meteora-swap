import { mqConnection } from './rabbit';
import { createMeteora } from './meteora';
import { RMQ_NOTIFY_QUEUE, RMQ_SWAP_TOKEN, RMQ_TX_QUEUE } from './config';
import { IncomingSwapToken, IncomingTransaction } from './types';
import { hasSwapTokenRequiredFields, hasTransactionRequiredFields } from './utils';
import { handleBNBPancake3 } from './pancake3/pancake3.handler';
import { handleBNBPancake } from './pancake/pancake.handler';

const start = async () => {
  await mqConnection.connect();
  const meteora = createMeteora(mqConnection);

  const handleIncomingNotification = async (msg: string) => {
    try {
      const parsedMessage = JSON.parse(msg) as IncomingTransaction;
      console.log(`☄️ | 📬 Received Notification: `, parsedMessage);

      if (!hasTransactionRequiredFields(parsedMessage)) {
        throw new Error(`☄️ | ❌ Отсутствуют обязательные поля во входящем cообщении`);
      }
      const buyYForX = parsedMessage.contractAddress === parsedMessage.caY;

      await meteora.swap(
        parsedMessage.poolAddress,
        parsedMessage.nameX,
        parsedMessage.nameY,
        parsedMessage.caX,
        parsedMessage.caY,
        parsedMessage?.amount ?? undefined, // default amount will be handled by the swap function
        parsedMessage.buyYForX ?? buyYForX,
        parsedMessage?.slippage ?? undefined,
        parsedMessage?.priorityFee ?? undefined
      );
    } catch (error) {
      console.error(`☄️ | ❌ Could not handle incoming notification: ${error.message}`);

      mqConnection.sendToQueue(RMQ_NOTIFY_QUEUE, {
        text: `☄️ | ❌ Ошибка при обработке входящего уведомления: ${error.message}`,
      });
    }
  };

  const handleIncomingSwapToken = async (msg: string) => {
    try {
      const parsedMessage = JSON.parse(msg) as IncomingSwapToken;
      console.log(`🍰 📬 | Received Swap Token Notification: `, parsedMessage);

      if (!hasSwapTokenRequiredFields(parsedMessage)) {
        throw new Error(`❌ | Отсутствуют обязательные поля во входящем cообщении`);
      }

      handleBNBPancake3({
        mqConnection,
        address: parsedMessage.address,
      }).catch(() => {
        handleBNBPancake({
          mqConnection,
          address: parsedMessage.address,
        });
      });

    } catch (error) {
      console.error(`❌ | Could not handle incoming notification: ${error.message}`);

      mqConnection.sendToQueue(RMQ_NOTIFY_QUEUE, {
        text: `❌ | Ошибка при обработке входящего уведомления: ${error.message}`,
      });
    }
  };

  await mqConnection.consume(handleIncomingNotification, RMQ_TX_QUEUE);
  await mqConnection.consume(handleIncomingSwapToken, RMQ_SWAP_TOKEN);

  // Send a test message to the queue to SWAP USDC to SOL
  // await mqConnection.sendToQueue(RMQ_TX_QUEUE, {
  //   poolAddress: '7zwc5JuKuyhgc1VELA59KGAY2xmd3HZGwJNLCfHXZP99',
  //   contractAddress: 'So11111111111111111111111111111111111111112',
  //   nameX: 'USDC',
  //   nameY: 'SOL',
  //   caX: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  //   caY: 'So11111111111111111111111111111111111111112',
  //   amount: 5,
  // });

  // await mqConnection.consume(console.log, RMQ_NOTIFY_QUEUE);
  // setInterval(() => {
  //   mqConnection.sendToQueue(RMQ_NOTIFY_QUEUE, {
  //     text: `✅ Successfully listened to incoming messages`,
  //   });
  // }, 15000);

  console.log(`☄️ | 🚀 Meteora is ready to swap`);
};

start();
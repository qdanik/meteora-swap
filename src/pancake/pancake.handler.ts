import { DEFAULT_BNB_AMOUNT, DEFAULT_BNB_GWEI, MAX_RETRY, RMQ_NOTIFY_QUEUE } from '../config';
import { RabbitMQConnection } from '../rabbit';
import { createPanCake } from './pancake';

const BNB = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c';

export const handleBNBPancake = async ({
  mqConnection,
  address,
}: {
  mqConnection: RabbitMQConnection;
  address: string;
}) => {
  try {
    let retryCount = 0;
    mqConnection.sendToQueue(RMQ_NOTIFY_QUEUE, { text: `🎂 ⌛️ | Начинаю свап <code>${address}</code> через PanCakeV2` });
    const pancake = createPanCake(mqConnection);

    const pool = await pancake.getPair(BNB, address);
    console.log(`🎂 | Ищем пул для ${address}`, pool);
    const reserves = await pancake.getReserves(pool);
    console.log("🎂 | Reserves", reserves);

    if (reserves === 'Pools not found') {
      mqConnection.sendToQueue(RMQ_NOTIFY_QUEUE, { text: `🎂 ❌ | Пул для <code>${address}</code> не найден` });
      console.log(`🎂 | ❌ Pools not found`);
      return;
    }

    const swapToken = async (token: string) => {
      try {
        return await pancake.swapBNBForTokens(address, DEFAULT_BNB_AMOUNT, DEFAULT_BNB_GWEI);
      } catch (error) {
        if (retryCount < MAX_RETRY) {
          retryCount++;
          console.log(`🍰 ⌛️ | (${retryCount}) Попробуем ещё раз...`);
          mqConnection.sendToQueue(RMQ_NOTIFY_QUEUE, { text: `🍰 ⌛️ | (${retryCount}) Попробуем ещё раз...` });
          return Promise.resolve(swapToken(token));
        }
        return Promise.reject(error);
      }
    };

    mqConnection.sendToQueue(RMQ_NOTIFY_QUEUE, { text: `🍰 ⌛️ | Найден пул для <code>${address}</code> -> <code>${pool}</code>` });
    await swapToken(address);
  } catch (error) {
    mqConnection.sendToQueue(RMQ_NOTIFY_QUEUE, { text: `🎂 ❌ | Ошибка при свапе: ${error.message}` });
    console.error(`🎂 | ❌ Error in swap: ${error.message}`);
  }
};
import { DEFAULT_BNB_AMOUNT, DEFAULT_BNB_GWEI, MAX_RETRY, RMQ_NOTIFY_QUEUE } from '../config';
import { RabbitMQConnection } from '../rabbit';
import { createPanCakeV3 } from './pancake3';
import { NETWORKS } from './pancake3.constants';

const BNB = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c';

export const handleBNBPancake3 = async ({
  mqConnection,
  address,
}: {
  mqConnection: RabbitMQConnection;
  address: string;
}) => {
  function logAndNotify(message: string) {
    if (mqConnection) {
      mqConnection.sendToQueue(RMQ_NOTIFY_QUEUE, { text: message });
    }
    console.log(message);
  }

  try {
    logAndNotify(`🍰 ⌛️ | Начинаю свап <code>${address}</code> через PanCakeV3`);

    let retryCount = 0;
    const pancakeV3 = createPanCakeV3(NETWORKS.BNB, logAndNotify);
    const pairPools = await pancakeV3.getPairPools(BNB, address);
    const pool = await pancakeV3.findPools(pairPools);

    if (pool === 'Pools not found') {
      logAndNotify(`🍰 ❌ | Пул для <code>${address}</code> не найден`);
      return;
    }

    const swapToken = async (token: string) => {
      try {
        return await pancakeV3.buyToken(token, DEFAULT_BNB_AMOUNT, DEFAULT_BNB_GWEI, pool);
      } catch (error) {
        if (retryCount < MAX_RETRY) {
          retryCount++;
          logAndNotify(`🍰 ⌛️ | (${retryCount}) Попробуем ещё раз...`);
          return Promise.resolve(swapToken(token));
        }
        return Promise.reject(error);
      }
    };

    logAndNotify(`🍰 ⌛️ | Найден пул для <code>${address}</code> -> <code>${pool.address}</code>`);
    await swapToken(address);
  } catch (error) {
    logAndNotify(`🍰 ❌ | Ошибка при свапе: ${error.message}`);
    console.error(`🍰 | ❌ Error in swap: ${error.message}`);
  }
};
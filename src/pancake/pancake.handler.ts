import { DEFAULT_BNB_AMOUNT, DEFAULT_BNB_GWEI, RMQ_NOTIFY_QUEUE } from '../config';
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
    mqConnection.sendToQueue(RMQ_NOTIFY_QUEUE, { text: `🍰 ⌛️ | Найден пул для <code>${address}</code> -> <code>${pool}</code>` });
    await pancake.swapBNBForTokens(address, DEFAULT_BNB_AMOUNT, DEFAULT_BNB_GWEI);
  } catch (error) {
    mqConnection.sendToQueue(RMQ_NOTIFY_QUEUE, { text: `🎂 ❌ | Ошибка при свапе: ${error.message}` });
    console.error(`🎂 | ❌ Error in swap: ${error.message}`);
  }
};
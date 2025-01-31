import client, { Connection, Channel, ConsumeMessage, } from 'amqplib';
import { RMQ_HOST, RMQ_PASS, RMQ_PORT, RMQ_TX_QUEUE, RMQ_USER } from './config';

type HandlerCB = (msg: string) => any;

class RabbitMQConnection {
  connection!: Connection;
  channel!: Channel;
  private connected!: Boolean;

  async connect() {
    if (this.connected && this.channel) return;
    else this.connected = true;

    try {
      console.log(`⌛️ Connecting to Rabbit-MQ Server`);
      this.connection = await client.connect(
        `amqp://${RMQ_USER}:${RMQ_PASS}@${RMQ_HOST}:${RMQ_PORT}`
      );

      console.log(`✅ Rabbit MQ Connection is ready`);

      this.channel = await this.connection.createChannel();

      console.log(`🛸 Created RabbitMQ Channel successfully`);
    } catch (error) {
      console.error(error);
      console.error(`❌ Not connected to MQ Server`);
    }
  }

  async sendToQueue(queue: string, message: any) {
    try {
      if (!this.channel) {
        await this.connect();
      }

      this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)));
    } catch (error) {
      console.error(error);
      throw error;
    }
  }


  async consume(handler: HandlerCB, queue: string = RMQ_TX_QUEUE) {
    await this.channel.assertQueue(queue, {
      durable: true,
    });

    const handleConsumeQueue = (msg: ConsumeMessage) => {
      if (!msg) {
        return console.error(`❌ Invalid incoming message`);
      }
      handler(msg?.content?.toString());
      this.channel.ack(msg);
    };

    this.channel.consume(queue, handleConsumeQueue, { noAck: false });

  }
}

export const mqConnection = new RabbitMQConnection();
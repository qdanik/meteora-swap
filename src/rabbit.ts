import client, { Connection, Channel, ConsumeMessage, } from 'amqplib';
import { RMQ_HOST, RMQ_PASS, RMQ_PORT, RMQ_TX_QUEUE, RMQ_USER } from './config';

type HandlerCB = (msg: string) => any;

export class RabbitMQConnection {
  connection!: Connection;
  channel!: Channel;
  private connected!: Boolean;

  private retryCount = 1;

  async reconnect() {
    const delay = 1000 * this.retryCount;
    setTimeout(async () => {
      try {
        console.log(`🐰 | ⌛️ Reconnecting to RabbitMQ Server in ${(delay / 1000).toFixed(0)}s`);
        this.retryCount++;
        await this.connect();
        this.retryCount = 1;
      } catch (error) {
        console.error(`🐰 | ❌ Error in Reconnecting to RabbitMQ Server`);
      }
    }, delay);
  }

  async connect() {
    if (this.connected && this.channel) return;
    else this.connected = true;

    try {
      console.log(`🐰 | ⌛️ Connecting to Rabbit-MQ Server`);
      this.connection = await client.connect({
        protocol: 'amqp',
        username: RMQ_USER,
        password: RMQ_PASS,
        hostname: RMQ_HOST,
        port: RMQ_PORT,
        heartbeat: 300,
      });

      console.log(`🐰 | ✅ Rabbit MQ Connection is ready`);
      this.channel = await this.connection.createChannel();

      this.connection.on('error', (err) => {
        console.error(`🐰 | ❌ Error in RabbitMQ Connection: ${err.message}`);
      });

      this.connection.on('close', () => {
        console.error(`🐰 | ❌ RabbitMQ Connection closed`);
        this.connected = false;
        // Reconnect
        this.reconnect();
      });

      console.log(`🐰 | 🛸 Created RabbitMQ Channel successfully`);
    } catch (error) {
      console.error(error);
      console.error(`🐰 | ❌ Not connected to MQ Server`);
      this.connected = false;
      // Reconnect
      this.reconnect();
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
        return console.error(`🐰 | ❌ Invalid incoming message`);
      }
      handler(msg?.content?.toString());
      this.channel.ack(msg);
    };

    this.channel.consume(queue, handleConsumeQueue, { noAck: false });

  }
}

export const mqConnection = new RabbitMQConnection();
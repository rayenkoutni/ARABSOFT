import { Kafka, Producer, Consumer, Partitioners, logLevel } from 'kafkajs';
import { KAFKA } from '@/lib/constants';

type KafkaReadyOptions = {
  timeoutMs?: number;
  intervalMs?: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

class KafkaService {
  private kafka: Kafka;
  private readinessKafka: Kafka;
  private producer: Producer | null = null;
  private consumer: Consumer | null = null;

  constructor() {
    this.kafka = new Kafka({
      clientId: KAFKA.CLIENT_ID,
      brokers: [...KAFKA.BROKERS],
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });
    this.readinessKafka = new Kafka({
      clientId: `${KAFKA.CLIENT_ID}-readiness`,
      brokers: [...KAFKA.BROKERS],
      logLevel: logLevel.NOTHING,
      retry: {
        initialRetryTime: 100,
        retries: 0,
      },
    });
  }

  async waitUntilReady(options: KafkaReadyOptions = {}) {
    const timeoutMs =
      options.timeoutMs ?? parsePositiveInteger(process.env.KAFKA_READY_TIMEOUT_MS, 30000);
    const intervalMs =
      options.intervalMs ?? parsePositiveInteger(process.env.KAFKA_READY_INTERVAL_MS, 1000);
    const deadline = Date.now() + timeoutMs;
    let lastError: unknown = null;

    while (Date.now() < deadline) {
      const admin = this.readinessKafka.admin();

      try {
        await admin.connect();
        await admin.listTopics();
        return;
      } catch (error) {
        lastError = error;
      } finally {
        try {
          await admin.disconnect();
        } catch {}
      }

      await sleep(intervalMs);
    }

    const reason = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`Kafka broker not ready after ${timeoutMs}ms: ${reason}`);
  }

  async initProducer() {
    if (this.producer) return this.producer;
    this.producer = this.kafka.producer({
      createPartitioner: Partitioners.LegacyPartitioner,
    });
    await this.producer.connect();
    return this.producer;
  }

  async initConsumer(groupId: string = KAFKA.GROUPS.CHAT_GROUP) {
    if (this.consumer) return this.consumer;
    this.consumer = this.kafka.consumer({ groupId });
    await this.consumer.connect();
    return this.consumer;
  }

  async send(topic: string, message: any) {
    if (!this.producer) {
      await this.initProducer();
    }
    await this.producer!.send({
      topic,
      messages: [{ value: JSON.stringify(message) }],
    });
  }

  async subscribe(topic: string, onMessage: (payload: any) => Promise<void>) {
    const consumer = await this.initConsumer();
    await consumer.subscribe({ topic, fromBeginning: false });
    
    await consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const payload = JSON.parse(message.value?.toString() || '{}');
          await onMessage(payload);
        } catch (error) {
          console.error('[kafka]', error);
        }
      },
    });
  }

  async disconnect() {
    if (this.producer) await this.producer.disconnect();
    if (this.consumer) await this.consumer.disconnect();
  }
}

export const kafkaService = new KafkaService();



import { Kafka, Producer, Consumer } from 'kafkajs';
import { KAFKA } from '@/lib';

class KafkaService {
  private kafka: Kafka;
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
  }

  async initProducer() {
    if (this.producer) return this.producer;
    this.producer = this.kafka.producer();
    await this.producer.connect();
    console.log('✅ Kafka producer connected');
    return this.producer;
  }

  async initConsumer(groupId: string = KAFKA.GROUPS.CHAT_GROUP) {
    if (this.consumer) return this.consumer;
    this.consumer = this.kafka.consumer({ groupId });
    await this.consumer.connect();
    console.log(`✅ Kafka consumer connected (Group: ${groupId})`);
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
          console.error(`❌ Error processing Kafka message on topic ${topic}:`, error);
        }
      },
    });
  }

  async disconnect() {
    if (this.producer) await this.producer.disconnect();
    if (this.consumer) await this.consumer.disconnect();
    console.log('🔌 Kafka disconnected');
  }
}

export const kafkaService = new KafkaService();


import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

// Render provides a full Redis URL; local Docker uses host+port.
function redisConnection() {
  if (process.env.REDIS_URL) {
    return { url: process.env.REDIS_URL };
  }
  return {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  };
}

@Global()
@Module({
  imports: [
    BullModule.forRoot({
      connection: redisConnection(),
    }),
  ],
  exports: [BullModule],
})
export class BullConfigModule {}

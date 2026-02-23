import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

const DEFAULT_TTL = 300; // 5 minutes

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private client: Redis;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    this.client = new Redis({
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      password: this.config.get<string>('REDIS_PASSWORD') || undefined,
      lazyConnect: true,
    });
    this.client.on('error', (err) =>
      this.logger.error('Redis CacheService error', err),
    );
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  /** Retrieve a cached value; returns null on miss or Redis error. */
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      this.logger.warn(`Cache GET failed for key "${key}"`, err);
      return null;
    }
  }

  /** Store a value in Redis. TTL is in seconds (default 300). */
  async set(key: string, value: unknown, ttlSec = DEFAULT_TTL): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSec);
    } catch (err) {
      this.logger.warn(`Cache SET failed for key "${key}"`, err);
    }
  }

  /** Delete one or more keys. */
  async del(...keys: string[]): Promise<void> {
    try {
      if (keys.length) await this.client.del(...keys);
    } catch (err) {
      this.logger.warn(`Cache DEL failed for keys "${keys.join(', ')}"`, err);
    }
  }

  /** Delete a single key (alias for del). */
  async invalidate(key: string): Promise<void> {
    await this.del(key);
  }

  // ── Tenant-scoped key helpers ──────────────────────────────────────────────

  availabilityKey(tenantId: string, page = 1, limit = 10) {
    return `availability:${tenantId}:${page}:${limit}`;
  }

  availabilityByInstructorKey(tenantId: string, instructorId: string, page = 1, limit = 10) {
    return `availability:${tenantId}:${instructorId}:${page}:${limit}`;
  }

  bookingsKey(tenantId: string, page = 1, limit = 10) {
    return `bookings:${tenantId}:${page}:${limit}`;
  }

  /** Invalidate all booking + availability cache entries for a tenant using keys search. */
  async invalidateBookings(tenantId: string) {
    try {
      const keys = await this.client.keys(`bookings:${tenantId}:*`);
      if (keys.length) await this.client.del(...keys);
      await this.del(`bookings:${tenantId}`);
    } catch (err) {
      this.logger.warn('Failed to invalidate bookings cache', err);
    }
  }

  async invalidateAvailability(tenantId: string, _instructorId?: string) {
    try {
      const keys = await this.client.keys(`availability:${tenantId}*`);
      if (keys.length) await this.client.del(...keys);
      await this.del(`availability:${tenantId}`);
    } catch (err) {
      this.logger.warn('Failed to invalidate availability cache', err);
    }
  }
}

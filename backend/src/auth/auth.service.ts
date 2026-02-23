import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from './../prisma/prisma.service';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JwtPayloadFields {
  user_id: string;
  role: string;
  tenant_id: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async login(dto: LoginDto, correlationId?: string): Promise<TokenPair> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase() },
      include: { role: true, tenant: true },
    });
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.issueTokenPair(user.id, user.role.name, user.tenant_id);

    await this.prisma.auditLog.create({
      data: {
        tenant_id: user.tenant_id,
        user_id: user.id,
        action: 'POST',
        entity_type: 'Login',
        entity_id: user.id,
        correlation_id: correlationId || randomBytes(8).toString('hex'),
      },
    }).catch(() => {});

    return tokens;
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: { include: { role: true } } },
    });
    if (!stored || stored.expiresAt < new Date()) {
      if (stored) {
        await this.prisma.refreshToken.delete({ where: { id: stored.id } }).catch(() => {});
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    const { user } = stored;
    await this.prisma.refreshToken.delete({ where: { id: stored.id } });
    return this.issueTokenPair(user.id, user.role.name, user.tenant_id);
  }

  async logout(refreshToken: string | null): Promise<void> {
    if (refreshToken) {
      await this.prisma.refreshToken.deleteMany({ where: { token: refreshToken } }).catch(() => {});
    }
  }

  private async issueTokenPair(
    userId: string,
    role: string,
    tenantId: string,
  ): Promise<TokenPair> {
    const secret = this.config.get<string>('JWT_PUBLIC_KEY') ?? this.config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_PUBLIC_KEY or JWT_SECRET must be set');
    }
    const expiresInRaw = this.config.get<string | number>('JWT_ACCESS_EXPIRES_SEC');
    const expiresIn = expiresInRaw ? parseInt(expiresInRaw.toString(), 10) : 900;
    const payload: JwtPayload & JwtPayloadFields = {
      sub: userId,
      user_id: userId,
      role,
      tenant_id: tenantId,
      type: 'access',
    };
    const accessToken = this.jwt.sign(payload, {
      secret,
      algorithm: 'HS256',
      expiresIn,
    });
    const refreshToken = randomBytes(48).toString('base64url');
    const refreshExpiresMs = (this.config.get<number>('JWT_REFRESH_EXPIRES_DAYS', 7) ?? 7) * 24 * 60 * 60 * 1000;
    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: refreshToken,
        expiresAt: new Date(Date.now() + refreshExpiresMs),
      },
    });
    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }
}

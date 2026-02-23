import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  user_id: string;
  role: string;
  tenant_id: string;
  type: 'access';
}

export interface JwtUser {
  user_id: string;
  role: string;
  tenant_id: string;
  email?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req) => req?.cookies?.token ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_PUBLIC_KEY') ?? config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtUser> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.user_id },
      include: { role: true },
    });
    if (!user || user.tenant_id !== payload.tenant_id) {
      throw new UnauthorizedException('User not found or tenant mismatch');
    }
    return {
      user_id: user.id,
      role: user.role.name,
      tenant_id: user.tenant_id,
      email: user.email,
    };
  }
}

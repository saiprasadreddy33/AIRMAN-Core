import { Body, Controller, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { AuthService, TokenPair } from './auth.service';
import { LoginDto } from './dto/login.dto';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Throttle({ global: { ttl: 60_000, limit: 5 } })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<TokenPair, 'refreshToken'>> {
    let correlationId = req.headers['x-correlation-id'];
    if (Array.isArray(correlationId)) correlationId = correlationId[0];
    const { accessToken, refreshToken, expiresIn } = await this.auth.login(dto, correlationId);
    res.cookie('token', accessToken, { ...COOKIE_OPTIONS, maxAge: expiresIn * 1000 });
    res.cookie('refreshToken', refreshToken, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 });
    return { accessToken, expiresIn };
  }

  @Public()
  @Throttle({ global: { ttl: 60_000, limit: 5 } })
  @Post('refresh')
  async refresh(
    @Body('refreshToken') refreshToken: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<TokenPair, 'refreshToken'>> {
    const token = refreshToken ?? (req as Request & { cookies?: { refreshToken?: string } }).cookies?.refreshToken;
    if (!token) {
      throw new UnauthorizedException('Refresh token required');
    }
    const pair = await this.auth.refresh(token);
    res.cookie('token', pair.accessToken, { ...COOKIE_OPTIONS, maxAge: pair.expiresIn * 1000 });
    res.cookie('refreshToken', pair.refreshToken, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 });
    return { accessToken: pair.accessToken, expiresIn: pair.expiresIn };
  }

  @Post('logout')
  async logout(
    @Body('refreshToken') refreshToken: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const token = refreshToken ?? (req as Request & { cookies?: { refreshToken?: string } }).cookies?.refreshToken;
    await this.auth.logout(token ?? null);
    res.clearCookie('token', COOKIE_OPTIONS);
    res.clearCookie('refreshToken', COOKIE_OPTIONS);
    return { message: 'Logged out' };
  }
}

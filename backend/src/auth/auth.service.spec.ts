import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';

jest.mock('argon2');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock }, refreshToken: { create: jest.Mock, findUnique: jest.Mock, delete: jest.Mock } };
  let jwt: { signAsync: jest.Mock };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: { findUnique: jest.fn() },
            refreshToken: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn() }
          },
        },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService) as any;
    jwt = module.get(JwtService) as any;
  });

  describe('login', () => {
    it('should throw UnauthorizedException on invalid user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login({ email: 'test@test.com', password: 'password'})).rejects.toThrow(UnauthorizedException);
      await expect(service.login({ email: 'test@test.com', password: 'password'})).rejects.toMatchObject({
        response: { message: 'INVALID_CREDENTIALS' }
      });
    });

    it('should throw UnauthorizedException on invalid password (argon2 mismatch)', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', passwordHash: 'hash', role: { name: 'student' } });
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(service.login({ email: 'test@test.com', password: 'wrong-pass'})).rejects.toThrow(UnauthorizedException);
    });

    it('should return accessToken and refreshToken on successful login', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'test@test.com', passwordHash: 'hash', role: { name: 'student' }, tenant_id: 'tenant-1' });
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      jwt.signAsync.mockResolvedValueOnce('access-token').mockResolvedValueOnce('refresh-token');
      prisma.refreshToken.create.mockResolvedValue({ token: 'refresh-token' });

      const result = await service.login({ email: 'test@test.com', password: 'password'});

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 900,
        user: { id: 'user-1', email: 'test@test.com', role: 'student' }
      });
    });
  });
});

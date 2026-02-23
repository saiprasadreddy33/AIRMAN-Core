import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';

jest.mock('argon2');

const mockUser = {
  id: 'user-1',
  email: 'test@test.com',
  passwordHash: 'hashed',
  tenant_id: 'tenant-1',
  role: { name: 'student' },
  tenant: { id: 'tenant-1', name: 'Test School' },
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: { findFirst: jest.Mock };
    refreshToken: { create: jest.Mock; findUnique: jest.Mock; delete: jest.Mock; deleteMany: jest.Mock };
    auditLog: { create: jest.Mock };
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: { findFirst: jest.fn() },
            refreshToken: {
              create: jest.fn(),
              findUnique: jest.fn(),
              delete: jest.fn(),
              deleteMany: jest.fn(),
            },
            auditLog: { create: jest.fn().mockResolvedValue({}) },
          },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('access-token') },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const cfg: Record<string, string | number> = {
                JWT_SECRET: 'test-secret',
                JWT_PUBLIC_KEY: 'test-secret',
                JWT_ACCESS_EXPIRES_SEC: 900,
                JWT_REFRESH_EXPIRES_DAYS: 7,
              };
              return cfg[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService) as unknown as typeof prisma;
  });

  describe('login', () => {
    it('should throw UnauthorizedException when user is not found', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.login({ email: 'test@test.com', password: 'password' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException on wrong password', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(false);
      await expect(service.login({ email: 'test@test.com', password: 'wrong' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should return tokens and write audit log on successful login', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      prisma.refreshToken.create.mockResolvedValue({ token: 'refresh-token' });

      const result = await service.login({ email: 'test@test.com', password: 'password' });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'POST',
            entity_type: 'Login',
            user_id: 'user-1',
            tenant_id: 'tenant-1',
          }),
        }),
      );
    });
  });
});

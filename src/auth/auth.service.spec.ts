import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from '../email/email.service';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

const mockUser = {
  id: 'user-uuid',
  email: 'test@oasisgym.com',
  password: '',
  role: 'CLIENT' as any,
  isActive: true,
  mustChangePassword: false,
  avatar: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  client: null,
};

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  passwordResetToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
  refreshToken: {
    upsert: jest.fn(),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    create: jest.fn().mockResolvedValue({}),
    findUnique: jest.fn(),
  },
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-token'),
  verifyAsync: jest.fn(),
};

const mockEmailService = {
  sendWelcome: jest.fn().mockResolvedValue(undefined),
  sendPasswordChange: jest.fn().mockResolvedValue(undefined),
  sendPasswordReset: jest.fn().mockResolvedValue(undefined),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should return tokens on successful login', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        password: hashedPassword,
      });
      mockPrisma.refreshToken.upsert.mockResolvedValue({});

      const result = await service.login({ email: 'test@oasisgym.com', password: 'password123' });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.message).toBe('Login successful');
    });

    it('should throw UnauthorizedException with wrong password', async () => {
      const hashedPassword = await bcrypt.hash('correctpass', 10);
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, password: hashedPassword });

      await expect(service.login({ email: 'test@oasisgym.com', password: 'wrongpass' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login({ email: 'nobody@oasisgym.com', password: 'pass' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if account is disabled', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        password: hashedPassword,
        isActive: false,
      });

      await expect(service.login({ email: 'test@oasisgym.com', password: 'password123' }))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('register', () => {
    it('should throw BadRequestException if email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.register({
        email: 'test@oasisgym.com',
        password: 'Pass123*',
        firstName: 'Test',
        lastName: 'User',
      })).rejects.toThrow(BadRequestException);
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const hashedPassword = await bcrypt.hash('oldPass123', 10);
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, password: hashedPassword });
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, mustChangePassword: false });

      const result = await service.changePassword('user-uuid', {
        currentPassword: 'oldPass123',
        newPassword: 'newPass123*',
      });

      expect(result.message).toBe('Password changed successfully');
      expect(mockPrisma.user.update).toHaveBeenCalled();
    });

    it('should throw BadRequestException with wrong current password', async () => {
      const hashedPassword = await bcrypt.hash('oldPass123', 10);
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, password: hashedPassword });

      await expect(service.changePassword('user-uuid', {
        currentPassword: 'wrongPass',
        newPassword: 'newPass123*',
      })).rejects.toThrow(BadRequestException);
    });
  });
});

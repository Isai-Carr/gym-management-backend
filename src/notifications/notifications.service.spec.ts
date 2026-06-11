import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

const mockPrisma = {
  notification: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  membership: { findMany: jest.fn() },
  user: { findUnique: jest.fn() },
};
const mockEmail = { sendMembershipExpiring: jest.fn().mockResolvedValue(undefined), sendMail: jest.fn().mockResolvedValue(undefined) };

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EmailService, useValue: mockEmail },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendExpirationWarning', () => {
    it('should return processed count', async () => {
      mockPrisma.membership.findMany.mockResolvedValue([]);
      const result = await service.sendExpirationWarning();
      expect(result.processed).toBe(0);
    });
  });
});

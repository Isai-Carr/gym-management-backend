import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceService } from './attendance.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const mockClient = {
  id: 'client-uuid',
  firstName: 'Maria',
  lastName: 'López',
  userId: 'user-uuid',
  user: { id: 'user-uuid', isActive: true },
  memberships: [{ id: 'membership-uuid', status: 'ACTIVE', endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), isActive: true }],
};

const mockPrisma = {
  client: { findUnique: jest.fn() },
  attendance: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

describe('AttendanceService', () => {
  let service: AttendanceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkIn', () => {
    it('should create attendance for valid client with active membership', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.attendance.create.mockResolvedValue({
        id: 'att-uuid', clientId: 'client-uuid', checkIn: new Date(),
        createdAt: new Date(), client: mockClient, activity: null,
      });

      const result = await service.checkIn({ clientId: 'client-uuid' });
      expect(result.clientId).toBe('client-uuid');
    });

    it('should throw NotFoundException if client does not exist', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(null);
      await expect(service.checkIn({ clientId: 'invalid' })).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if account is disabled', async () => {
      mockPrisma.client.findUnique.mockResolvedValue({ ...mockClient, user: { isActive: false } });
      await expect(service.checkIn({ clientId: 'client-uuid' })).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if no active membership', async () => {
      mockPrisma.client.findUnique.mockResolvedValue({ ...mockClient, memberships: [] });
      await expect(service.checkIn({ clientId: 'client-uuid' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('findByClient', () => {
    it('should return attendance for existing client', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.attendance.findMany.mockResolvedValue([]);
      const result = await service.findByClient('client-uuid');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should throw NotFoundException for unknown client', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(null);
      await expect(service.findByClient('invalid')).rejects.toThrow(NotFoundException);
    });
  });
});

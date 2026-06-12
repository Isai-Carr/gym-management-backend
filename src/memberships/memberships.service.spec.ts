import { Test, TestingModule } from '@nestjs/testing';
import { MembershipsService } from './memberships.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  membershipPlan: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
  membership: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  client: { findUnique: jest.fn() },
};

describe('MembershipsService', () => {
  let service: MembershipsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembershipsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MembershipsService>(MembershipsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPlans', () => {
    it('should return all plans', async () => {
      mockPrisma.membershipPlan.findMany.mockResolvedValue([{ id: '1', name: 'Ilimitado' }]);
      const result = await service.getPlans();
      expect(result).toHaveLength(1);
    });
  });
});

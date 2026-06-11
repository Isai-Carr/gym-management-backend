import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  auditLog: { create: jest.fn().mockResolvedValue({ id: '1' }), findMany: jest.fn() },
};

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create an audit log', async () => {
    await service.createLog({ action: 'TEST', method: 'GET', endpoint: '/test' });
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
  });
});

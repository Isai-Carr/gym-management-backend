import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentStatus, PaymentMethod } from '@prisma/client';

const mockMembership = {
  id: 'membership-uuid',
  clientId: 'client-uuid',
  planId: 'plan-uuid',
  startDate: new Date(),
  endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  isActive: true,
  status: 'ACTIVE',
  client: {
    id: 'client-uuid',
    firstName: 'Juan',
    lastName: 'García',
    userId: 'user-uuid',
    user: { id: 'user-uuid', email: 'juan@test.com' },
  },
  plan: { id: 'plan-uuid', name: 'Ilimitado', price: 1200 },
};

const mockPayment = {
  id: 'payment-uuid',
  membershipId: 'membership-uuid',
  clientId: 'client-uuid',
  amount: 1200,
  status: PaymentStatus.PENDING,
  paymentMethod: PaymentMethod.TRANSFER,
  voucherUrl: null,
  transactionId: null,
  notes: null,
  paidAt: null,
  approvedBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  membership: mockMembership,
};

const mockPrisma = {
  payment: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  membership: {
    findUnique: jest.fn(),
  },
  client: {
    findUnique: jest.fn(),
  },
};

const mockEmailService = {
  sendPaymentReceived: jest.fn().mockResolvedValue(undefined),
  sendPaymentApproved: jest.fn().mockResolvedValue(undefined),
  sendPaymentRejected: jest.fn().mockResolvedValue(undefined),
};

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    jest.clearAllMocks();
  });

  describe('getPayment', () => {
    it('should return a payment by ID', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);
      const result = await service.getPayment('payment-uuid');
      expect(result.id).toBe('payment-uuid');
    });

    it('should throw NotFoundException if payment not found', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);
      await expect(service.getPayment('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('approvePayment', () => {
    it('should approve a PENDING payment', async () => {
      const pendingPayment = { ...mockPayment, status: PaymentStatus.PENDING };
      mockPrisma.payment.findUnique.mockResolvedValue(pendingPayment);
      mockPrisma.payment.update.mockResolvedValue({
        ...pendingPayment,
        status: PaymentStatus.APPROVED,
        paidAt: new Date(),
      });

      const result = await service.approvePayment('payment-uuid', 'admin-uuid');
      expect(result.status).toBe(PaymentStatus.APPROVED);
      expect(mockEmailService.sendPaymentApproved).toHaveBeenCalled();
    });

    it('should throw BadRequestException if payment is not PENDING', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.APPROVED,
      });

      await expect(service.approvePayment('payment-uuid', 'admin-uuid'))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('rejectPayment', () => {
    it('should reject a PENDING payment', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrisma.payment.update.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.REJECTED,
      });

      const result = await service.rejectPayment('payment-uuid', 'admin-uuid', 'Comprobante inválido');
      expect(result.status).toBe(PaymentStatus.REJECTED);
      expect(mockEmailService.sendPaymentRejected).toHaveBeenCalled();
    });
  });

  describe('getPayments', () => {
    it('should return all payments', async () => {
      mockPrisma.payment.findMany.mockResolvedValue([mockPayment]);
      const result = await service.getPayments();
      expect(result).toHaveLength(1);
    });

    it('should filter by status', async () => {
      mockPrisma.payment.findMany.mockResolvedValue([]);
      await service.getPayments(PaymentStatus.PENDING);
      expect(mockPrisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: PaymentStatus.PENDING },
        }),
      );
    });
  });
});

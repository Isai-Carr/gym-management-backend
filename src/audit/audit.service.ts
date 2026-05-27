import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async createLog(data: {
    userId?: string;
    action: string;
    method: string;
    endpoint: string;
    ipAddress?: string;
    payload?: any;
  }) {
    return this.prisma.auditLog.create({
      data,
    });
  }
}
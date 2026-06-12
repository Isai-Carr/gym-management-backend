import { Test, TestingModule } from '@nestjs/testing';
import { MembershipsController } from './memberships.controller';
import { MembershipsService } from './memberships.service';

const mockService = {
  createPlan: jest.fn(), getPlans: jest.fn(), getMemberships: jest.fn(),
  createMembership: jest.fn(), getMembership: jest.fn(),
};

describe('MembershipsController', () => {
  let controller: MembershipsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MembershipsController],
      providers: [{ provide: MembershipsService, useValue: mockService }],
    }).compile();

    controller = module.get<MembershipsController>(MembershipsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

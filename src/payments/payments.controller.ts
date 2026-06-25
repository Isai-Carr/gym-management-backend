import {
  Body, Controller, Get, Param, Patch, Post,
  Query, Request, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiQuery } from '@nestjs/swagger';
import { Role, PaymentStatus } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateDirectPaymentDto } from './dto/create-direct-payment.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { TransferPaymentDto } from './dto/transfer-payment.dto';
import { CreateCardPaymentDto } from './dto/create-card-payment.dto';

const voucherStorage = diskStorage({
  destination: join(process.cwd(), 'storage', 'payments'),
  filename: (_req, file, cb) => {
    cb(null, `${uuidv4()}${extname(file.originalname)}`);
  },
});

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Register a payment manually (Admin)' })
  createPayment(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.createPayment(dto);
  }

  @Post('transfer')
  @UseInterceptors(FileInterceptor('voucher', {
    storage: voucherStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = /jpg|jpeg|png|pdf/;
      if (!allowed.test(extname(file.originalname).toLowerCase())) {
        return cb(new Error('Only JPG, PNG and PDF files are allowed'), false);
      }
      cb(null, true);
    },
  }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Submit a transfer payment with voucher (Client)' })
  createTransfer(
    @Body() dto: TransferPaymentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const voucherPath = file ? `/storage/payments/${file.filename}` : undefined;
    return this.paymentsService.createTransferPayment(dto, voucherPath);
  }

  @Post('cash')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Register cash payment (Admin)' })
  createCash(@Body() dto: CreateDirectPaymentDto) {
    return this.paymentsService.createCashPayment(dto);
  }

  @Post('terminal')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Register terminal payment (Admin)' })
  createTerminal(@Body() dto: CreateDirectPaymentDto) {
    return this.paymentsService.createTerminalPayment(dto);
  }

  @Patch('approve/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Approve a transfer payment (Admin)' })
  approve(@Param('id') id: string, @Request() req: any) {
    return this.paymentsService.approvePayment(id, req.user.id);
  }

  @Patch('reject/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Reject a transfer payment (Admin)' })
  reject(
    @Param('id') id: string,
    @Request() req: any,
    @Body('reason') reason?: string,
  ) {
    return this.paymentsService.rejectPayment(id, req.user.id, reason);
  }

  // ── Specific GET routes must come before /:id ────────────────────────────

  @Get('my')
  @ApiOperation({ summary: 'Get my payment history (Client)' })
  getMyPayments(@Request() req: any) {
    return this.paymentsService.getMyPayments(req.user.id);
  }

  @Get('pending')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get pending payments (Admin)' })
  getPending() {
    return this.paymentsService.getPendingPayments();
  }

  @Get('config/mp-public-key')
  @ApiOperation({ summary: 'Get MercadoPago public key for the frontend SDK' })
  getMpPublicKey() {
    return { publicKey: process.env.MERCADOPAGO_PUBLIC_KEY ?? null };
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get all payments (Admin)' })
  @ApiQuery({ name: 'status', enum: PaymentStatus, required: false })
  getPayments(@Query('status') status?: PaymentStatus) {
    return this.paymentsService.getPayments(status);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get payment by ID (Admin)' })
  getPayment(@Param('id') id: string) {
    return this.paymentsService.getPayment(id);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update payment status (Admin)' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdatePaymentStatusDto) {
    return this.paymentsService.updatePaymentStatus(id, dto);
  }

  // ── MercadoPago ───────────────────────────────────────────────────────────

  @Post('card')
  @ApiOperation({
    summary: 'Pay with credit/debit card via MercadoPago',
    description:
      'The frontend tokenizes the card with the MP JS SDK and sends the token here. ' +
      'The card number never reaches this server.',
  })
  createCardPayment(@Body() dto: CreateCardPaymentDto) {
    return this.paymentsService.createCardPayment(dto);
  }

  @Post('webhook/mercadopago')
  @ApiOperation({ summary: 'MercadoPago webhook — do not call manually' })
  mercadopagoWebhook(
    @Body() body: any,
    @Query('id') queryId?: string,
    @Query('data.id') dataId?: string,
  ) {
    const mpPaymentId = body?.data?.id ?? dataId ?? queryId;
    if (!mpPaymentId || body?.type !== 'payment') return { received: true };
    return this.paymentsService.handleMercadopagoWebhook(String(mpPaymentId));
  }
}

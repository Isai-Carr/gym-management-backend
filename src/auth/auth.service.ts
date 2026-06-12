import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  private generateTemporaryPassword(): string {
    return String(Math.floor(1000000 + Math.random() * 9000000));
  }

  async registerAdmin(dto: CreateAdminDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new BadRequestException('Email already exists');

    const temporaryPassword = this.generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        role: Role.ADMIN,
        mustChangePassword: true,
      },
    });

    const name = `${dto.firstName} ${dto.lastName}`.trim();
    const loginUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:3001'}/login`;
    await this.emailService.sendWelcome(dto.email, name, temporaryPassword, loginUrl);

    const { password: _p, ...safeUser } = user;
    return { message: 'Admin registered successfully', user: safeUser };
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new BadRequestException('Email already exists');

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        role: Role.CLIENT,
        mustChangePassword: true,
        client: {
          create: {
            firstName: dto.firstName ?? '',
            lastName: dto.lastName ?? '',
            phone: dto.phone,
          },
        },
      },
      include: { client: true },
    });

    const name = [dto.firstName, dto.lastName].filter(Boolean).join(' ') || dto.email;
    const loginUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:3001'}/login`;
    await this.emailService.sendWelcome(dto.email, name, '', loginUrl);

    const token = this.generateToken(user.id, user.email, user.role);
    const { password: _p, ...safeUser } = user;
    return { message: 'User registered successfully', token, user: safeUser };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { client: true },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.isActive) throw new UnauthorizedException('Account is disabled');

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) throw new UnauthorizedException('Invalid credentials');

    const accessToken = this.generateToken(user.id, user.email, user.role);
    const refreshToken = this.generateRefreshToken(user.id, user.email, user.role);

    await this.prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const { password: _p, ...safeUser } = user;
    return {
      message: user.mustChangePassword ? 'Password change required' : 'Login successful',
      mustChangePassword: user.mustChangePassword,
      accessToken,
      refreshToken,
      user: safeUser,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { client: true },
    });
    if (!user) {
      return { message: 'If the email exists, a reset link has been sent' };
    }

    await this.prisma.passwordResetToken.deleteMany({ where: { email: dto.email } });

    const token = crypto.randomBytes(32).toString('hex');

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await this.prisma.passwordResetToken.create({
      data: { email: dto.email, token, expiresAt },
    });

    const resetUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:3001'}/reset-password?token=${token}`;
    const name = user.client
      ? `${user.client.firstName} ${user.client.lastName}`
      : dto.email;

    await this.emailService.sendPasswordReset(dto.email, name, resetUrl);

    return { message: 'If the email exists, a reset link has been sent' };
  }

  async resetPassword(token: string, password: string) {
    const resetToken = await this.prisma.passwordResetToken.findUnique({ where: { token } });
    if (!resetToken) throw new BadRequestException('Invalid or expired token');
    if (new Date() > resetToken.expiresAt) throw new BadRequestException('Token expired');

    const hashedPassword = await bcrypt.hash(password, 10);
    await this.prisma.user.update({
      where: { email: resetToken.email },
      data: { password: hashedPassword, mustChangePassword: false },
    });
    await this.prisma.passwordResetToken.delete({ where: { token } });

    return { message: 'Password reset successful' };
  }

  async refreshToken(dto: RefreshTokenDto) {
    try {
      const payload = await this.jwtService.verifyAsync(dto.refreshToken);
      const stored = await this.prisma.refreshToken.findUnique({ where: { token: dto.refreshToken } });
      if (!stored || stored.expiresAt < new Date()) {
        throw new UnauthorizedException('Refresh token expired');
      }

      const accessToken = this.generateToken(payload.sub, payload.email, payload.role);
      return { accessToken };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      await this.prisma.refreshToken.deleteMany({
        where: { userId, token: refreshToken },
      });
    }
    return { message: 'Logout successful' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { client: true },
    });
    if (!user) throw new BadRequestException('User not found');

    const passwordMatch = await bcrypt.compare(dto.currentPassword, user.password);
    if (!passwordMatch) throw new BadRequestException('Current password is incorrect');

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword, mustChangePassword: false },
    });

    const name = user.client
      ? `${user.client.firstName} ${user.client.lastName}`.trim()
      : user.email;
    await this.emailService.sendPasswordChange(user.email, name);

    return { message: 'Password changed successfully' };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        client: {
          include: {
            memberships: {
              where: { status: 'ACTIVE', endDate: { gte: new Date() } },
              include: { plan: true },
              take: 1,
            },
          },
        },
      },
    });
    if (!user) throw new UnauthorizedException('User not found');
    const { password: _p, ...safeUser } = user;
    return safeUser;
  }

  private generateToken(userId: string, email: string, role: Role): string {
    return this.jwtService.sign({ sub: userId, email, role }, { expiresIn: '1d' });
  }

  private generateRefreshToken(userId: string, email: string, role: Role): string {
    return this.jwtService.sign({ sub: userId, email, role }, { expiresIn: '7d' });
  }
}

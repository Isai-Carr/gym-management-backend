import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';

import * as bcrypt from 'bcrypt';

import { randomBytes } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';

import { EmailService } from '../email/email.service';

import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

import { ForgotPasswordDto } from './dto/forgot-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,

    private jwtService: JwtService,

    private emailService: EmailService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser =
      await this.prisma.user.findUnique({
        where: {
          email: dto.email,
        },
      });

    if (existingUser) {
      throw new BadRequestException(
        'Email already exists',
      );
    }

    const hashedPassword =
      await bcrypt.hash(dto.password, 10);

    const user =
      await this.prisma.user.create({
        data: {
          email: dto.email,

          password: hashedPassword,

          client: {
            create: {
              firstName: dto.firstName,

              lastName: dto.lastName,

              phone: dto.phone,
            },
          },
        },

        include: {
          client: true,
        },
      });

    const token = await this.generateToken(
      user.id,
      user.email,
    );

    return {
      message:
        'User registered successfully',

      token,

      user,
    };
  }

  async login(dto: LoginDto) {
    const user =
      await this.prisma.user.findUnique({
        where: {
          email: dto.email,
        },

        include: {
          client: true,
        },
      });

    if (!user) {
      throw new UnauthorizedException(
        'Invalid credentials',
      );
    }

    const passwordMatch =
      await bcrypt.compare(
        dto.password,
        user.password,
      );

    if (!passwordMatch) {
      throw new UnauthorizedException(
        'Invalid credentials',
      );
    }

    const token = await this.generateToken(
      user.id,
      user.email,
    );

    return {
      message: 'Login successful',

      token,

      user,
    };
  }

  async forgotPassword(
    dto: ForgotPasswordDto,
  ) {
    const user =
      await this.prisma.user.findUnique({
        where: {
          email: dto.email,
        },
      });

    if (!user) {
      throw new BadRequestException(
        'User not found',
      );
    }

    const token = randomBytes(32).toString(
      'hex',
    );

    const expiresAt = new Date();

    expiresAt.setHours(
      expiresAt.getHours() + 1,
    );

    await this.prisma.passwordResetToken.create(
      {
        data: {
          email: dto.email,

          token,

          expiresAt,
        },
      },
    );

    const resetLink = `http://localhost:3000/reset-password?token=${token}`;

    await this.emailService.sendMail(
      dto.email,

      'Reset your password',

      `
      <h2>Password Reset</h2>

      <p>Click below to reset your password:</p>

      <a href="${resetLink}">
        Reset Password
      </a>
      `,
    );

    return {
      message:
        'Password reset email sent',
    };
  }

  async resetPassword(
    token: string,

    password: string,
  ) {
    const resetToken =
      await this.prisma.passwordResetToken.findUnique(
        {
          where: {
            token,
          },
        },
      );

    if (!resetToken) {
      throw new BadRequestException(
        'Invalid token',
      );
    }

    if (
      resetToken.expiresAt < new Date()
    ) {
      throw new BadRequestException(
        'Token expired',
      );
    }

    const hashedPassword =
      await bcrypt.hash(password, 10);

    await this.prisma.user.update({
      where: {
        email: resetToken.email,
      },

      data: {
        password: hashedPassword,
      },
    });

    await this.prisma.passwordResetToken.delete(
      {
        where: {
          token,
        },
      },
    );

    return {
      message:
        'Password reset successful',
    };
  }

  async generateToken(
    userId: string,

    email: string,
  ) {
    return this.jwtService.sign({
      sub: userId,

      email,
    });
  }
}
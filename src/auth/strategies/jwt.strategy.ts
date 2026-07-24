import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { PassportStrategy } from '@nestjs/passport';

import { ExtractJwt, Strategy } from 'passport-jwt';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private prisma: PrismaService,

    configService: ConfigService,
  ) {
    super({
      jwtFromRequest:
        ExtractJwt.fromAuthHeaderAsBearerToken(),

      ignoreExpiration: false,

      secretOrKey:
        configService.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: any) {
    // Access and refresh tokens share the same signing secret and payload shape
    // apart from `type` — without this check, a leaked refresh token (7-day TTL)
    // would work as a Bearer access token on every protected endpoint.
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid access token');
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: payload.sub,
      },

      include: {
        client: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account disabled or not found');
    }

    const { password: _pwd, ...safeUser } = user;
    return safeUser;
  }
}
import { InternalServerErrorException, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserModule } from 'src/user/user.module';
import { CommonModule } from 'src/common/common.module';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    UserModule,
    CommonModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;

        if (!secret) {
          throw new InternalServerErrorException(
            'JWT_SECRET not found in .env',
          );
        }
        const expiresIn = process.env.JWT_EXPIRATION
          ? parseInt(process.env.JWT_EXPIRATION)
          : 86400;

        return {
          secret,
          signOptions: {
            expiresIn,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [],
})
export class AuthModule {}

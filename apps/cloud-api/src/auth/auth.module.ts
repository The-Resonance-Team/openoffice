import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule, type JwtSignOptions } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { JwtStrategy } from "./jwt.strategy";

// JWT foundation only — sign-in itself lands with OpenAuth.js (cloud ADR
// 0005); this module signs/verifies the member session tokens.
@Global()
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("jwt.secret"),
        // zod-validated string; cast at the config trust boundary
        signOptions: {
          expiresIn: config.get<string>(
            "jwt.expiresIn"
          ) as JwtSignOptions["expiresIn"],
        },
      }),
    }),
  ],
  providers: [JwtStrategy],
  exports: [JwtModule],
})
export class AuthModule {}

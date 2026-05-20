import { Module } from '@nestjs/common';
import { AuthPreludeController } from './auth-prelude.controller';
import { AuthPreludeService } from './auth-prelude.service';

@Module({
  controllers: [AuthPreludeController],
  providers: [AuthPreludeService],
})
export class AuthPreludeModule {}

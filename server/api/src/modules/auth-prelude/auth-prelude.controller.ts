import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { AuthPreludeService } from './auth-prelude.service';
import { SendCodeDto } from './dto/send-code.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';

@Controller('auth')
export class AuthPreludeController {
  constructor(private readonly service: AuthPreludeService) {}

  @Public()
  @HttpCode(200)
  @Post('send-code')
  sendCode(@Body() dto: SendCodeDto) {
    return this.service.sendCode(dto.phone);
  }

  @Public()
  @HttpCode(200)
  @Post('verify-code')
  verifyCode(@Body() dto: VerifyCodeDto) {
    return this.service.verifyCode(dto.phone, dto.code);
  }
}

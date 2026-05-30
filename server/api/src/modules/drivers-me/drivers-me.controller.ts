import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { DriverGuard } from '../../common/guards/driver.guard';
import { AssignmentsQueryDto } from './dto/assignments-query.dto';
import { EarningsQueryDto } from './dto/earnings-query.dto';
import { MarkDeliveredDto } from './dto/mark-delivered.dto';
import { OnlineStatusDto } from './dto/online-status.dto';
import { PushTokenDto } from './dto/push-token.dto';
import { ReportProblemDto } from './dto/report-problem.dto';
import { RespondAssignmentDto } from './dto/respond-assignment.dto';
import { DriversMeService } from './drivers-me.service';

@Controller('driver')
@UseGuards(DriverGuard)
export class DriversMeController {
  constructor(private readonly svc: DriversMeService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.svc.getMe(user.id);
  }

  @Patch('me/online')
  setOnline(@CurrentUser() user: AuthUser, @Body() dto: OnlineStatusDto) {
    return this.svc.setOnline(user.id, dto.is_active);
  }

  @Post('push-token')
  setPushToken(@CurrentUser() user: AuthUser, @Body() dto: PushTokenDto) {
    return this.svc.setPushToken(user.id, dto.expo_push_token);
  }

  @Get('assignments')
  listAssignments(
    @CurrentUser() user: AuthUser,
    @Query() query: AssignmentsQueryDto,
  ) {
    return this.svc.listMyAssignments(user.id, query.status);
  }

  @Get('assignments/:id')
  getAssignment(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.getMyAssignment(user.id, id);
  }

  @Patch('assignments/:id/respond')
  respond(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RespondAssignmentDto,
  ) {
    return this.svc.respond(user.id, id, dto.status, dto.note);
  }

  @Patch('assignments/:id/picked-up')
  pickedUp(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.markPickedUp(user.id, id);
  }

  @Patch('assignments/:id/delivered')
  delivered(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: MarkDeliveredDto,
  ) {
    return this.svc.markDelivered(user.id, id, {
      method: dto.method,
      code: dto.code,
    });
  }

  @Post('assignments/:id/report')
  report(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReportProblemDto,
  ) {
    return this.svc.reportProblem(user.id, id, dto.category, dto.description);
  }

  @Get('earnings')
  earnings(
    @CurrentUser() user: AuthUser,
    @Query() query: EarningsQueryDto,
  ) {
    return this.svc.earnings(user.id, query.period);
  }
}

import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class DriverGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    if (req.user?.role !== 'driver') {
      throw new ForbiddenException('Driver access required');
    }
    return true;
  }
}

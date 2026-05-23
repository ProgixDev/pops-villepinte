import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  id: string;
  phone: string | null;
  email: string | null;
  role: 'customer' | 'admin' | 'driver';
  profile: {
    id: string;
    name: string | null;
    phone: string | null;
    orderCount: number;
    role: 'customer' | 'admin' | 'driver';
  };
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user;
  },
);

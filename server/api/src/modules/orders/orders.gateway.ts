import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

export interface OrderEvent {
  type:
    | 'order:created'
    | 'order:status_changed'
    | 'order:cancelled'
    | 'order:deleted';
  data: Record<string, unknown>;
}

@Injectable()
export class OrdersGateway {
  private readonly subject = new Subject<OrderEvent>();

  emit(event: OrderEvent) {
    this.subject.next(event);
  }

  get events$() {
    return this.subject.asObservable();
  }
}

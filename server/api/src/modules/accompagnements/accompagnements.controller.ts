import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { AccompagnementsService } from './accompagnements.service';

@Controller('accompagnements')
@Public()
export class AccompagnementsController {
  constructor(
    private readonly accompagnementsService: AccompagnementsService,
  ) {}

  @Get()
  list() {
    return this.accompagnementsService.list();
  }
}

import { Module } from '@nestjs/common';
import { AccompagnementsController } from './accompagnements.controller';
import { AccompagnementsService } from './accompagnements.service';

@Module({
  controllers: [AccompagnementsController],
  providers: [AccompagnementsService],
  exports: [AccompagnementsService],
})
export class AccompagnementsModule {}

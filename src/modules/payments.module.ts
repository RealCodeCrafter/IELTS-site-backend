import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from '../payments/payment.entity';
import { Subscription } from '../payments/subscription.entity';
import { AttemptAccess } from '../payments/attempt-access.entity';
import { User } from '../users/user.entity';
import { PaymentsService } from '../payments/payments.service';
import { PaymentsController } from '../payments/payments.controller';
import { OCRService } from '../payments/ocr.service';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, Subscription, AttemptAccess, User])],
  providers: [PaymentsService, OCRService],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}


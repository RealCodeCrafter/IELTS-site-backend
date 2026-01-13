import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from '../admin/admin.controller';
import { UploadController } from '../admin/upload.controller';
import { AdminService } from '../admin/admin.service';
import { ExamsModule } from './exams.module';
import { User } from '../users/user.entity';
import { Exam } from '../exams/exam.entity';
import { Attempt } from '../exams/attempt.entity';

@Module({
  imports: [ExamsModule, TypeOrmModule.forFeature([User, Exam, Attempt])],
  controllers: [AdminController, UploadController],
  providers: [AdminService],
})
export class AdminModule {}


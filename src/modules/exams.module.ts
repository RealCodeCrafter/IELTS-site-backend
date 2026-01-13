import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExamsService } from '../exams/exams.service';
import { ExamsController } from '../exams/exams.controller';
import { Exam } from '../exams/exam.entity';
import { Attempt } from '../exams/attempt.entity';
import { Score } from '../exams/score.entity';
import { UsersModule } from './users.module';
import { AiModule } from './ai.module';

@Module({
  imports: [TypeOrmModule.forFeature([Exam, Attempt, Score]), UsersModule, AiModule],
  providers: [ExamsService],
  controllers: [ExamsController],
  exports: [ExamsService],
})
export class ExamsModule {}



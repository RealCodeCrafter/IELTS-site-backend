import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../users/user.entity';
import { ExamType } from './exam.entity';

@Controller('exams')
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Get()
  list() {
    return this.examsService.listExams();
  }

  @Post('create')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Body() body: { title: string; type: ExamType; content: Record<string, unknown> }) {
    return this.examsService.createExam(body);
  }

  @Post(':id/submit')
  @UseGuards(JwtAuthGuard)
  submit(
    @Param('id') examId: string,
    @Body() body: { userId: string; answers: Record<string, unknown> },
  ) {
    return this.examsService.submitAttempt({
      examId,
      userId: body.userId,
      answers: body.answers,
    });
  }

  @Get('user/:userId')
  @UseGuards(JwtAuthGuard)
  listUserAttempts(@Param('userId') userId: string) {
    return this.examsService.listAttemptsForUser(userId);
  }

  @Get('attempt/:id')
  @UseGuards(JwtAuthGuard)
  getAttempt(@Param('id') id: string) {
    return this.examsService.getAttempt(id);
  }

  @Get(':id')
  getExamById(@Param('id') id: string) {
    return this.examsService.getExamById(id);
  }
}


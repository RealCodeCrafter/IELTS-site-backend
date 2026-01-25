import { Body, Controller, ForbiddenException, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../users/user.entity';
import { ExamContent, ExamType } from './exam.entity';
import { Request } from 'express';

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
  create(@Body() body: { title: string; type: ExamType; content: ExamContent }) {
    // ✅ body.content endi ExamContent turiga mos
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
  @UseGuards(JwtAuthGuard)
  async getExamById(@Param('id') id: string, @Req() req: Request) {
    const userId = (req as any).user?.id;
    // Check balance and deduct when accessing exam (only if no existing draft attempt)
    await this.examsService.ensureExamAccess(userId, id);
    return this.examsService.getExamById(id);
  }
}


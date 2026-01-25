import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ExamsService } from '../exams/exams.service';
import { AdminService } from './admin.service';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../users/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Exam } from '../exams/exam.entity';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    private readonly examsService: ExamsService,
    private readonly adminService: AdminService,
  ) {}

  // Statistics
  @Get('stats')
  getStatistics() {
    return this.adminService.getStatistics();
  }

  // Users
  @Get('users')
  getAllUsers() {
    return this.adminService.getAllUsers();
  }

  @Get('users/:id')
  getUserById(@Param('id') id: string) {
    return this.adminService.getUserById(id);
  }

  @Delete('users/:id')
  deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  // Exams
  @Get('exams')
  getAllExams() {
    return this.adminService.getAllExams();
  }

  @Get('exams/:id')
  getExamById(@Param('id') id: string) {
    return this.adminService.getExamById(id);
  }

  @Post('exams')
  createExam(@Body() data: Partial<Exam>) {
    return this.adminService.createExam(data);
  }

  @Put('exams/:id')
  updateExam(@Param('id') id: string, @Body() data: Partial<Exam>) {
    return this.adminService.updateExam(id, data);
  }

  @Delete('exams/:id')
  deleteExam(@Param('id') id: string) {
    return this.adminService.deleteExam(id);
  }

  // Attempts
  @Get('attempts')
  listAttempts() {
    return this.examsService.listAllAttempts();
  }

  // Payments
  @Get('payments')
  getAllPayments(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.adminService.getAllPayments(startDate, endDate);
  }

  @Put('payments/:id/approve')
  approvePayment(@Param('id') id: string) {
    return this.adminService.approvePayment(id);
  }

  @Put('payments/:id/reject')
  rejectPayment(@Param('id') id: string) {
    return this.adminService.rejectPayment(id);
  }
}


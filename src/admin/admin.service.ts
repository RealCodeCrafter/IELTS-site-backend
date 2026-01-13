import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../users/user.entity';
import { Exam } from '../exams/exam.entity';
import { Attempt } from '../exams/attempt.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Exam) private readonly examRepo: Repository<Exam>,
    @InjectRepository(Attempt) private readonly attemptRepo: Repository<Attempt>,
  ) {}

  // Users CRUD
  async getAllUsers() {
    const users = await this.userRepo.find({
      relations: ['profile', 'attempts'],
      order: { createdAt: 'DESC' },
    });
    return users.map((u) => ({
      id: u.id,
      login: u.login,
      role: u.role,
      createdAt: u.createdAt,
      profile: u.profile
        ? {
            firstName: u.profile.firstName,
            lastName: u.profile.lastName,
          }
        : null,
      attempts: u.attempts ? u.attempts.length : 0,
    }));
  }

  async getUserById(id: string) {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['profile', 'attempts', 'attempts.exam', 'attempts.score'],
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async deleteUser(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    await this.userRepo.remove(user);
    return { message: 'User deleted successfully' };
  }

  // Exams CRUD
  async createExam(data: Partial<Exam>) {
    const exam = this.examRepo.create(data);
    return this.examRepo.save(exam);
  }

  async updateExam(id: string, data: Partial<Exam>) {
    const exam = await this.examRepo.findOne({ where: { id } });
    if (!exam) throw new NotFoundException('Exam not found');
    Object.assign(exam, data);
    return this.examRepo.save(exam);
  }

  async deleteExam(id: string) {
    const exam = await this.examRepo.findOne({ where: { id } });
    if (!exam) throw new NotFoundException('Exam not found');
    await this.examRepo.remove(exam);
    return { message: 'Exam deleted successfully' };
  }

  async getAllExams() {
    return this.examRepo.find({
      relations: ['attempts'],
      order: { id: 'DESC' },
    });
  }

  async getExamById(id: string) {
    const exam = await this.examRepo.findOne({
      where: { id },
      relations: ['attempts'],
    });
    if (!exam) throw new NotFoundException('Exam not found');
    return exam;
  }

  // Statistics
  async getStatistics() {
    const [users, exams, attempts] = await Promise.all([
      this.userRepo.count(),
      this.examRepo.count(),
      this.attemptRepo.count(),
    ]);

    const students = await this.userRepo.count({ where: { role: UserRole.STUDENT } });
    const admins = await this.userRepo.count({ where: { role: UserRole.ADMIN } });

    return {
      totalUsers: users,
      totalStudents: students,
      totalAdmins: admins,
      totalExams: exams,
      totalAttempts: attempts,
    };
  }
}


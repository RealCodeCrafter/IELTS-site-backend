import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { User, UserRole } from '../users/user.entity';
import { Exam } from '../exams/exam.entity';
import { Attempt } from '../exams/attempt.entity';
import { Payment } from '../payments/payment.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Exam) private readonly examRepo: Repository<Exam>,
    @InjectRepository(Attempt) private readonly attemptRepo: Repository<Attempt>,
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
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
    
    // Delete all attempts related to this user first (scores will be deleted automatically due to CASCADE)
    const attempts = await this.attemptRepo.find({ where: { user: { id } } });
    if (attempts.length > 0) {
      await this.attemptRepo.remove(attempts);
    }
    
    // Now delete the user
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
    
    // Delete all attempts related to this exam first (scores will be deleted automatically due to CASCADE)
    const attempts = await this.attemptRepo.find({ where: { exam: { id } } });
    if (attempts.length > 0) {
      await this.attemptRepo.remove(attempts);
    }
    
    // Now delete the exam
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

  // Payments
  async getAllPayments(startDate?: string, endDate?: string) {
    const queryBuilder = this.paymentRepo
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.user', 'user')
      .orderBy('payment.createdAt', 'DESC');

    // Filter by date range if provided
    if (startDate && endDate) {
      queryBuilder.where('payment.createdAt BETWEEN :startDate AND :endDate', {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });
    }

    const payments = await queryBuilder.getMany();
    return payments.map((p) => ({
      id: p.id,
      userId: p.user?.id,
      userLogin: p.user?.login,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      type: p.type,
      provider: p.provider,
      screenshotUrl: p.screenshotUrl,
      cardLastDigits: p.cardLastDigits,
      paymentDate: p.paymentDate,
      createdAt: p.createdAt,
    }));
  }

  async approvePayment(id: string) {
    const payment = await this.paymentRepo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!payment) throw new NotFoundException('Payment not found');

    if (payment.status === 'paid') {
      return { message: 'Payment already approved' };
    }

    payment.status = 'paid';
    await this.paymentRepo.save(payment);

    // Add balance to user
    if (payment.user) {
      const user = await this.userRepo.findOne({ where: { id: payment.user.id } });
      if (user) {
        user.balance = (Number(user.balance) || 0) + Number(payment.amount);
        await this.userRepo.save(user);
      }
    }

    return { message: 'Payment approved and balance added', payment };
  }

  async rejectPayment(id: string) {
    const payment = await this.paymentRepo.findOne({ where: { id } });
    if (!payment) throw new NotFoundException('Payment not found');

    payment.status = 'failed';
    await this.paymentRepo.save(payment);

    return { message: 'Payment rejected', payment };
  }
}


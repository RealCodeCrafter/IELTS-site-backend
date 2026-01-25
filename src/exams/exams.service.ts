import { Injectable, NotFoundException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Exam } from './exam.entity';
import { Attempt } from './attempt.entity';
import { Score } from './score.entity';
import { UsersService } from '../users/users.service';
import { AiScoringService } from '../ai/ai-scoring.service';
import { PaymentsService } from '../payments/payments.service';

interface SubmitAttemptPayload {
  examId: string;
  userId: string;
  answers: Record<string, unknown>;
}

@Injectable()
export class ExamsService {
  constructor(
    @InjectRepository(Exam) private readonly examRepo: Repository<Exam>,
    @InjectRepository(Attempt) private readonly attemptRepo: Repository<Attempt>,
    @InjectRepository(Score) private readonly scoreRepo: Repository<Score>,
    private readonly usersService: UsersService,
    private readonly aiScoring: AiScoringService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
  ) {}

  createExam(data: Partial<Exam>) {
    const exam = this.examRepo.create(data);
    return this.examRepo.save(exam);
  }

  listExams() {
    return this.examRepo.find({
      select: ['id', 'title', 'type', 'content'],
    });
  }

  async checkExamAccess(userId: string, examId: string): Promise<boolean> {
    if (!userId) return false;
    return await this.paymentsService.hasEnoughBalance(userId);
  }

  async deductBalanceForExam(userId: string): Promise<void> {
    await this.paymentsService.deductBalanceForExam(userId);
  }

  // Ensure user has access to exam - check balance and deduct only if no existing draft attempt
  async ensureExamAccess(userId: string, examId: string): Promise<void> {
    if (!userId) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check if user already has a draft attempt for this exam (not submitted yet)
    const existingDraftAttempt = await this.attemptRepo.findOne({
      where: {
        user: { id: userId },
        exam: { id: examId },
        status: 'draft',
      },
    });

    // If draft attempt exists, user already paid - just allow access
    if (existingDraftAttempt) {
      return;
    }

    // Check if user has enough balance
    const hasEnough = await this.paymentsService.hasEnoughBalance(userId);
    if (!hasEnough) {
      throw new ForbiddenException('Insufficient balance. You need 10,000 UZS to take an exam. Please top up your balance.');
    }

    // Deduct balance and create draft attempt
    await this.paymentsService.deductBalanceForExam(userId);
    
    // Create draft attempt to track that user has paid for this exam
    const exam = await this.examRepo.findOne({ where: { id: examId } });
    const user = await this.usersService.findById(userId);
    if (exam && user) {
      const draftAttempt = this.attemptRepo.create({
        exam,
        user,
        answers: {},
        status: 'draft',
      });
      await this.attemptRepo.save(draftAttempt);
    }
  }

  async getExamById(id: string) {
    const exam = await this.examRepo.findOne({ where: { id } });
    if (!exam) throw new NotFoundException('Exam not found');
    // Remove correct answers before sending to student
    const examForStudent = this.removeCorrectAnswers(exam);
    return examForStudent;
  }

  private removeCorrectAnswers(exam: Exam): Exam {
    if (!exam.content || typeof exam.content !== 'object') {
      return exam;
    }
    
    const content = JSON.parse(JSON.stringify(exam.content));
    
    if (content && content.listening && content.listening.sections && Array.isArray(content.listening.sections)) {
      content.listening.sections = content.listening.sections.map((section: any) => ({
        ...section,
        questions: Array.isArray(section.questions)
          ? section.questions.map((q: any) => {
              const { correctAnswer, ...questionWithoutAnswer } = q;
              return questionWithoutAnswer;
            })
          : [],
      }));
    }

    if (content && content.reading && content.reading.passages && Array.isArray(content.reading.passages)) {
      content.reading.passages = content.reading.passages.map((passage: any) => ({
        ...passage,
        questions: Array.isArray(passage.questions)
          ? passage.questions.map((q: any) => {
              const { correctAnswer, ...questionWithoutAnswer } = q;
              return questionWithoutAnswer;
            })
          : [],
      }));
    }

    return { ...exam, content };
  }

  async submitAttempt(payload: SubmitAttemptPayload) {
    const exam = await this.examRepo.findOne({ where: { id: payload.examId } });
    if (!exam) throw new NotFoundException('Exam not found');
    const user = await this.usersService.findById(payload.userId);
    if (!user) throw new NotFoundException('User not found');

    // Check if there's an existing draft attempt
    let attempt = await this.attemptRepo.findOne({
      where: {
        user: { id: payload.userId },
        exam: { id: payload.examId },
        status: 'draft',
      },
    });

    if (attempt) {
      // Update existing draft attempt
      attempt.answers = payload.answers;
      attempt.status = 'submitted';
    } else {
      // Create new attempt (shouldn't happen normally, but handle it)
      attempt = this.attemptRepo.create({
        exam,
        user,
        answers: payload.answers,
        status: 'submitted',
      });
    }
    
    const saved = await this.attemptRepo.save(attempt);

    const scoreResult = await this.aiScoring.score(exam, payload.answers);
    const score = this.scoreRepo.create({
      listening: scoreResult.listening,
      reading: scoreResult.reading,
      writing: scoreResult.writing,
      speaking: scoreResult.speaking,
      overall: scoreResult.overall,
    });
    score.attempt = saved;
    await this.scoreRepo.save(score);

    saved.score = score;
    saved.status = 'scored';
    const finalAttempt = await this.attemptRepo.save(saved);
    
    // Serialize attempt with detailed results
    const serialized = this.serializeAttempt(finalAttempt);
    return {
      ...serialized,
      detailedResults: scoreResult.detailedResults,
    };
  }

  async listAttemptsForUser(userId: string) {
    const attempts = await this.attemptRepo.find({
      where: { user: { id: userId } },
      relations: ['exam', 'score'],
      order: { createdAt: 'DESC' },
    });
    return attempts.map((a) => this.serializeAttempt(a));
  }

  async getAttempt(id: string) {
    const attempt = await this.attemptRepo.findOne({
      where: { id },
      relations: ['exam', 'score', 'user', 'user.profile'],
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    return this.serializeAttempt(attempt);
  }

  async listAllAttempts() {
    const attempts = await this.attemptRepo.find({
      relations: ['user', 'user.profile', 'exam', 'score'],
      order: { createdAt: 'DESC' },
    });
    return attempts.map((a) => this.serializeAttempt(a));
  }

  private serializeAttempt(attempt: Attempt) {
    return {
      id: attempt.id,
      answers: attempt.answers,
      status: attempt.status,
      createdAt: attempt.createdAt,
      updatedAt: attempt.updatedAt,
      exam: attempt.exam
        ? {
            id: attempt.exam.id,
            title: attempt.exam.title,
            type: attempt.exam.type,
          }
        : null,
      user: attempt.user
        ? {
            id: attempt.user.id,
            login: attempt.user.login,
            role: attempt.user.role,
            profile: attempt.user.profile
              ? {
                  firstName: attempt.user.profile.firstName,
                  lastName: attempt.user.profile.lastName,
                }
              : null,
          }
        : null,
      score: attempt.score
        ? {
            id: attempt.score.id,
            listening: attempt.score.listening,
            reading: attempt.score.reading,
            writing: attempt.score.writing,
            speaking: attempt.score.speaking,
            overall: attempt.score.overall,
          }
        : null,
    };
  }
}


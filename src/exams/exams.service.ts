import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Exam } from './exam.entity';
import { Attempt } from './attempt.entity';
import { Score } from './score.entity';
import { UsersService } from '../users/users.service';
import { AiScoringService } from '../ai/ai-scoring.service';

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

    const attempt = this.attemptRepo.create({
      exam,
      user,
      answers: payload.answers,
      status: 'submitted',
    });
    const saved = await this.attemptRepo.save(attempt);

    const scoreValues = await this.aiScoring.score(exam, payload.answers);
    const score = this.scoreRepo.create(scoreValues);
    score.attempt = saved;
    await this.scoreRepo.save(score);

    saved.score = score;
    saved.status = 'scored';
    const finalAttempt = await this.attemptRepo.save(saved);
    return this.serializeAttempt(finalAttempt);
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


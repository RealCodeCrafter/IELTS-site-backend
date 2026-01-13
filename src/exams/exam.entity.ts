import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Attempt } from './attempt.entity';

export type ExamType = 'full' | 'listening' | 'reading' | 'writing' | 'speaking';

export interface ListeningSection {
  sectionNumber: number;
  audioUrl?: string;
  transcript?: string;
  questions: Question[];
}

export interface ReadingPassage {
  passageNumber: number;
  title: string;
  content: string;
  questions: Question[];
}

export interface WritingTask {
  taskNumber: number;
  type: 'task1' | 'task2';
  title: string;
  description: string;
  wordCount: number;
  imageUrl?: string; // For Task 1 graphs/charts
}

export interface SpeakingPart {
  partNumber: number;
  title: string;
  description: string;
  questions?: string[];
  topic?: string;
  timeLimit?: number;
}

export interface Question {
  id: string;
  type: 'multiple-choice' | 'fill-blank' | 'true-false' | 'matching' | 'short-answer';
  question: string;
  options?: string[]; // For multiple choice
  correctAnswer: string | string[];
  points: number;
}

export interface ExamContent {
  description?: string;
  examDuration: number; // minutes
  listening?: {
    sections: ListeningSection[];
    totalQuestions: number;
  };
  reading?: {
    passages: ReadingPassage[];
    totalQuestions: number;
  };
  writing?: {
    tasks: WritingTask[];
  };
  speaking?: {
    parts: SpeakingPart[];
  };
}

@Entity('exams')
export class Exam {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  title!: string;

  @Column({ type: 'enum', enum: ['full', 'listening', 'reading', 'writing', 'speaking'] })
  type!: ExamType;

  @Column({ type: 'jsonb', default: {} })
  content!: ExamContent;

  @OneToMany(() => Attempt, (attempt) => attempt.exam)
  attempts?: Attempt[];
}

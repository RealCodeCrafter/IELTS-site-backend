import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Exam } from './exam.entity';
import { Score } from './score.entity';

@Entity('attempts')
export class Attempt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, (user) => user.attempts, { eager: true })
  user!: User;

  @ManyToOne(() => Exam, (exam) => exam.attempts, { eager: true })
  exam!: Exam;

  @Column({ type: 'jsonb', default: {} })
  answers!: Record<string, unknown>;

  @Column({ default: 'submitted' })
  status!: 'draft' | 'submitted' | 'scored';

  @OneToOne(() => Score, (score) => score.attempt, {
    cascade: true,
    eager: true,
  })
  @JoinColumn()
  score?: Score;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}


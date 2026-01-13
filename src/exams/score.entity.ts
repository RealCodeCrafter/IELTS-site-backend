import { Column, Entity, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Attempt } from './attempt.entity';

@Entity('scores')
export class Score {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'float', default: 0 })
  listening!: number;

  @Column({ type: 'float', default: 0 })
  reading!: number;

  @Column({ type: 'float', default: 0 })
  writing!: number;

  @Column({ type: 'float', default: 0 })
  speaking!: number;

  @Column({ type: 'float', default: 0 })
  overall!: number;

  @OneToOne(() => Attempt, (attempt) => attempt.score, { onDelete: 'CASCADE' })
  attempt!: Attempt;
}


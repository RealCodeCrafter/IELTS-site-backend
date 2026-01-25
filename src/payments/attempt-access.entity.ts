import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('attempt_access')
export class AttemptAccess {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'varchar', length: 50 })
  examId: string;

  @Column({ type: 'int', default: 1 })
  availableAttempts: number; // Number of attempts user can make

  @Column({ type: 'int', default: 0 })
  usedAttempts: number; // Number of attempts already used

  @CreateDateColumn()
  createdAt: Date;
}

import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';

export type PaymentStatus = 'pending' | 'paid' | 'failed';
export type PaymentType = 'subscription' | 'single_attempt' | 'balance_topup';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.id, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'varchar', length: 50 })
  provider: string; // 'click'

  @Column({ type: 'varchar', length: 50 })
  type: PaymentType;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 10, default: 'UZS' })
  currency: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  planCode: string | null; // e.g. 'MONTHLY', 'ONE_ATTEMPT'

  @Column({ type: 'varchar', length: 50, nullable: true })
  examId: string | null; // for single attempt purchase

  @Column({ type: 'varchar', length: 32, nullable: true })
  providerTransactionId: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  clickPaydocId: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  screenshotUrl: string | null; // Screenshot file path for manual payment

  @Column({ type: 'varchar', length: 20, nullable: true })
  cardLastDigits: string | null; // Last 4 digits of card from screenshot

  @Column({ type: 'timestamp', nullable: true })
  paymentDate: Date | null; // Payment date extracted from screenshot

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: PaymentStatus;

  @CreateDateColumn()
  createdAt: Date;
}


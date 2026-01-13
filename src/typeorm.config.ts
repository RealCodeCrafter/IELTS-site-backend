import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSourceOptions } from 'typeorm';

import { User } from './users/user.entity';
import { Profile } from './users/profile.entity';
import { Exam } from './exams/exam.entity';
import { Attempt } from './exams/attempt.entity';
import { Score } from './exams/score.entity';

/**
 * Runtime uchun (NestJS ishlayotganda)
 */
export const typeormConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get<string>('DB_HOST', 'localhost'),
  port: Number(configService.get<string>('DB_PORT', '5432')),
  username: configService.get<string>('DB_USER', 'postgres'),
  password: configService.get<string>('DB_PASS', 'postgres'),
  database: configService.get<string>('DB_NAME', 'ielts_platform'),
  entities: [User, Profile, Exam, Attempt, Score],
  synchronize: configService.get<string>('DB_SYNC', 'true') === 'true',
});

/**
 * Migration uchun (typeorm cli)
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASS ?? 'postgres',
  database: process.env.DB_NAME ?? 'ielts_platform',
  entities: [User, Profile, Exam, Attempt, Score],
  synchronize: process.env.DB_SYNC === 'true',
};

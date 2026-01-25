import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from './users.module';
import { AuthModule } from './auth.module';
import { ExamsModule } from './exams.module';
import { AdminModule } from './admin.module';
import { AiModule } from './ai.module';
import { PaymentsModule } from './payments.module';

import { typeormConfig } from '../typeorm.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        typeormConfig(configService),
    }),

    UsersModule,
    AuthModule,
    ExamsModule,
    AdminModule,
    AiModule,
    PaymentsModule,
  ],
})
export class AppModule {}

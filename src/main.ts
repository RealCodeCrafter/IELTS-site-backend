import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './modules/app.module';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { createAdminIfNotExists } from './utils/create-admin';
import { seedExams } from './utils/seed-exams';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Increase body size limit for file uploads (audio files can be large)
  app.use(require('express').json({ limit: '50mb' }));
  app.use(require('express').urlencoded({ extended: true, limit: '50mb' }));
  
  // CORS configuration - allow all origins
  app.enableCors({
    origin: true, // Allow all origins
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400, // 24 hours
  });

  // Create upload directories if they don't exist
  const uploadDir = path.join(process.cwd(), 'upload');
  const paymentsDir = path.join(process.cwd(), 'upload', 'payments');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('✅ Upload papkasi yaratildi');
  }
  if (!fs.existsSync(paymentsDir)) {
    fs.mkdirSync(paymentsDir, { recursive: true });
    console.log('✅ Payments upload papkasi yaratildi');
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Avtomatik admin va imtihonlar yaratish
  try {
    const dataSource = app.get<DataSource>(getDataSourceToken());
    await createAdminIfNotExists(dataSource);
    await seedExams(dataSource);
  } catch (error) {
    console.warn('⚠️  Seed ma\'lumotlar yaratishda xatolik (baza hali tayyor emas bo\'lishi mumkin):', error);
  }

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT') || 4000;

  // Serve static files from upload folder
  const express = require('express');
  const uploadPath = path.join(process.cwd(), 'upload');
  app.use('/upload', express.static(uploadPath));

  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`🚀 API running on http://localhost:${port}`);
}

void bootstrap();


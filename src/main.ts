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
  
  // CORS configuration for production
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://ielts-site-frontend-q5dn.vercel.app',
    process.env.FRONTEND_URL,
  ].filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // In development, allow all origins
      if (process.env.NODE_ENV === 'development') {
        return callback(null, true);
      }
      
      // In production, check against allowed origins
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        // Log for debugging
        console.log('CORS blocked origin:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400, // 24 hours
  });

  // Create upload directory if it doesn't exist
  const uploadDir = path.join(process.cwd(), 'upload');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('✅ Upload papkasi yaratildi');
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
  app.use('/upload', express.static('upload'));

  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`🚀 API running on http://localhost:${port}`);
}

void bootstrap();


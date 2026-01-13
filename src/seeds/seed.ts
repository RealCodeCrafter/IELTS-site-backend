import 'dotenv/config';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../typeorm.config';
import { createAdminIfNotExists } from '../utils/create-admin';
import { seedExams } from '../utils/seed-exams';

async function seed() {
  const dataSource = new DataSource(dataSourceOptions);
  await dataSource.initialize();

  await createAdminIfNotExists(dataSource);
  await seedExams(dataSource);

  await dataSource.destroy();
  console.log('✅ Seed ma\'lumotlar muvaffaqiyatli yuklandi!');
}

seed().catch((err) => {
  console.error('❌ Seed xatosi:', err);
  process.exit(1);
});


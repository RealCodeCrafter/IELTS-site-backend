import { DataSource } from 'typeorm';
import * as argon2 from 'argon2';
import { User, UserRole } from '../users/user.entity';
import { Profile } from '../users/profile.entity';

export async function createAdminIfNotExists(dataSource: DataSource) {
  const userRepo = dataSource.getRepository(User);
  const profileRepo = dataSource.getRepository(Profile);

  const adminExists = await userRepo.findOne({
    where: { login: 'admin', role: UserRole.ADMIN },
  });

  if (!adminExists) {
    const adminPassword = await argon2.hash('admin123');
    const adminUser = userRepo.create({
      login: 'admin',
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
    });
    const savedUser = await userRepo.save(adminUser);

    const adminProfile = profileRepo.create({
      firstName: 'Admin',
      lastName: 'User',
      user: savedUser,
    });
    await profileRepo.save(adminProfile);

    console.log('✅ Admin foydalanuvchi avtomatik yaratildi:');
    console.log('   Login: admin');
    console.log('   Parol: admin123');
    return true;
  }

  console.log('ℹ️  Admin foydalanuvchi allaqachon mavjud');
  return false;
}





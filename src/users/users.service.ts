import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './user.entity';
import { Profile } from './profile.entity';
import { CreateUserDto } from './dto/create-user.dto';
import * as argon2 from 'argon2';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Profile) private readonly profilesRepo: Repository<Profile>,
  ) {}

  async createStudent(dto: CreateUserDto): Promise<User> {
    const passwordHash = await argon2.hash(dto.password);
    
    // Avval User ni yaratish va saqlash
    const user = this.usersRepo.create({
      login: dto.login,
      passwordHash,
      role: UserRole.STUDENT,
    });
    const savedUser = await this.usersRepo.save(user);
    
    // Keyin Profile ni yaratish va saqlash
    const profile = this.profilesRepo.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      user: savedUser,
    });
    await this.profilesRepo.save(profile);
    
    // User ni profile bilan qaytarish
    return this.usersRepo.findOne({
      where: { id: savedUser.id },
      relations: ['profile'],
    }) as Promise<User>;
  }

  findByLogin(login: string) {
    return this.usersRepo.findOne({
      where: { login },
      relations: ['profile'],
    });
  }

  findById(id: string) {
    return this.usersRepo.findOne({
      where: { id },
      relations: ['profile'],
    });
  }

  async listAll(): Promise<User[]> {
    return this.usersRepo.find({ relations: ['profile'] });
  }

  async updateProfile(userId: string, profileData: { firstName: string; lastName: string; phone?: string; city?: string }) {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      relations: ['profile'],
    });
    if (!user) throw new Error('User not found');

    if (user.profile) {
      Object.assign(user.profile, profileData);
      await this.profilesRepo.save(user.profile);
    } else {
      const profile = this.profilesRepo.create({
        ...profileData,
        user,
      });
      await this.profilesRepo.save(profile);
    }

    return this.usersRepo.findOne({
      where: { id: userId },
      relations: ['profile'],
    });
  }
}


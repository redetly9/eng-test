import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { IUserData, User } from '../models/user.model';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User)
    private userModel: typeof User,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string): Promise<IUserData | null> {
    const user = await this.userModel.findOne({
      where: { login: username },
    });

    if (user) {
      // Пользователь существует - проверяем пароль
      if (await bcrypt.compare(password, user.password_hash)) {
        const { password_hash, ...result } = user.toJSON();
        return result;
      }
      return null; // Неверный пароль
    } else {
      // Пользователь не существует - создаем нового
      const saltRounds = 10;
      const password_hash = await bcrypt.hash(password, saltRounds);
      
      // Роли по имени: admin, Никита -> nikita, остальные -> user
      const role =
        username === 'admin' ? 'admin' :
        username === 'Никита' ? 'nikita' : 'user';
      
      const newUser = await this.userModel.create({
        login: username,
        password_hash,
        role,
      });

      const { password_hash: _, ...result } = newUser.toJSON();
      return result;
    }
  }

  async login(user: IUserData) {
    const payload = { username: user.login, sub: user.login, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}

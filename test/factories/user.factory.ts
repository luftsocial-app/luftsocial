import { UserRole } from '../../src/common/enums/roles';
import { User } from '../../src/entities/user.entity';
import { DatabaseHelper } from '../helpers/database.helper';

export class UserFactory {
  static async create(overrides: Partial<User> = {}): Promise<User> {
    const repository = DatabaseHelper.getRepository<User>(User);

    const user = repository.create({
      email: `test-${Date.now()}@example.com`,
      username: `testuser-${Date.now()}`,
      userRole: UserRole.MEMBER,
      ...overrides,
    });

    return repository.save(user);
  }

  static async createMany(count: number): Promise<User[]> {
    const users: User[] = [];
    for (let i = 0; i < count; i++) {
      users.push(await this.create());
    }
    return users;
  }
}

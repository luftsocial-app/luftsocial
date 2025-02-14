import { Group } from '../../src/entities/group.entity';
import { DatabaseHelper } from '../helpers/database.helper';

export class GroupFactory {
  static async create(overrides: Partial<Group> = {}): Promise<Group> {
    const repository = DatabaseHelper.getRepository<Group>(Group);

    const group = repository.create({
      name: `Test Group ${Date.now()}`,
      description: 'Test group description',
      ...overrides,
    });

    return repository.save(group);
  }
}

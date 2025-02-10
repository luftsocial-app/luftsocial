import {
  DataSource,
  DeepPartial,
  EntityTarget,
  FindManyOptions,
  FindOneOptions,
  ObjectLiteral,
  Repository,
  SelectQueryBuilder,
  UpdateResult,
  DeleteResult,
  FindOptionsWhere,
} from 'typeorm';

export class CustomTenantAwareRepository<T extends ObjectLiteral> {
  private organizationId = '';
  private readonly baseRepository: Repository<T>;

  constructor(dataSource: DataSource, entity: EntityTarget<T>) {
    this.baseRepository = dataSource.getRepository(entity);
  }

  setTenantId(organizationId: string): void {
    this.organizationId = organizationId;
  }

  private isTenantSet(): boolean {
    return (
      typeof this.organizationId === 'string' &&
      this.organizationId.trim().length > 0
    );
  }

  createTenantQueryBuilder(alias: string): SelectQueryBuilder<T> {
    const qb = this.baseRepository.createQueryBuilder(alias);
    if (this.isTenantSet()) {
      qb.andWhere(`${alias}.organizationId = :organizationId`, {
        organizationId: this.organizationId,
      });
    }
    return qb;
  }

  async find(options?: FindManyOptions<T>): Promise<T[]> {
    if (this.isTenantSet()) {
      options = options || {};
      options.where = options.where || {};
      Object.assign(options.where, { organizationId: this.organizationId });
    }
    return this.baseRepository.find(options);
  }

  async findOne(options: FindOneOptions<T>): Promise<T | null> {
    if (this.isTenantSet()) {
      options = options || {};
      options.where = options.where || {};
      Object.assign(options.where, { organizationId: this.organizationId });
    }
    return this.baseRepository.findOne(options);
  }

  async update(
    criteria: FindOptionsWhere<T>,
    partialEntity: DeepPartial<T>,
  ): Promise<UpdateResult> {
    if (this.isTenantSet()) {
      Object.assign(criteria, { organizationId: this.organizationId });
    }
    return this.baseRepository.update(criteria, partialEntity);
  }

  async delete(criteria: FindOptionsWhere<T>): Promise<DeleteResult> {
    if (this.isTenantSet()) {
      Object.assign(criteria, { organizationId: this.organizationId });
    }
    return this.baseRepository.delete(criteria);
  }

  // Delegate other necessary repository methods
  create(entityLike: DeepPartial<T>): T {
    return this.baseRepository.create(entityLike);
  }

  async save(entity: Partial<T>): Promise<T> {
    return this.baseRepository.save(entity as T);
  }
}

export type TenantAwareRepository<T extends ObjectLiteral> =
  CustomTenantAwareRepository<T>;

export function createTenantAwareRepository<T extends ObjectLiteral>(
  dataSource: DataSource,
  entity: EntityTarget<T>,
): TenantAwareRepository<T> {
  return new CustomTenantAwareRepository(dataSource, entity);
}

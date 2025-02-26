// import { Injectable } from '@nestjs/common';
// import { Repository } from 'typeorm';

// @Injectable()
// export class TenantAwareRepository {
//   private tenantId: string = '';

//   constructor(protected readonly baseRepository: Repository<any>) {}

//   setTenantId(tenantId: string): void {
//     this.tenantId = tenantId;
//   }

//   private withTenant(criteria: any = {}) {
//     return this.tenantId ? { ...criteria, tenantId: this.tenantId } : criteria;
//   }

//   find(options: any = {}) {
//     options.where = this.withTenant(options.where);
//     return this.baseRepository.find(options);
//   }

//   findOne(options: any = {}) {
//     options.where = this.withTenant(options.where);
//     return this.baseRepository.findOne(options);
//   }

//   create(data: any) {
//     return this.baseRepository.create(data);
//   }

//   save(data: any) {
//     return this.baseRepository.save(data);
//   }

//   delete(criteria: any) {
//     return this.baseRepository.delete(this.withTenant(criteria));
//   }
// }

import { Repository, SelectQueryBuilder, DataSource } from 'typeorm';
import { Request } from 'express';

export class TenantAwareRepository<Entity> extends Repository<Entity> {
  constructor(
    private readonly entity: any,
    private readonly dataSource: DataSource,
    private readonly tenantId: string,
  ) {
    super(entity, dataSource.createEntityManager());
  }

  // Dynamically construct the query builder with tenantId
  createQueryBuilder(
    alias: string,
    queryRunner?: any,
  ): SelectQueryBuilder<Entity> {
    const qb = super.createQueryBuilder(alias, queryRunner);
    qb.andWhere(`${alias}.tenantId = :tenantId`, { tenantId: this.tenantId }); // Apply tenantId to all queries
    return qb;
  }

  // Find all entities with tenantId applied
  async find(options?: any): Promise<Entity[]> {
    const qb = this.createQueryBuilder(this.metadata.tableName);
    if (options) {
      qb.setFindOptions(options); // Apply options (where, relations, etc.)
    }
    return qb.getMany();
  }

  // Find one entity with tenantId applied
  async findOne(options?: any): Promise<Entity | null> {
    const qb = this.createQueryBuilder(this.metadata.tableName);
    if (options) {
      qb.setFindOptions(options); // Apply options (where, relations, etc.)
    }
    return qb.getOne();
  }

  // Find and count entities with tenantId applied
  async findAndCount(options?: any): Promise<[Entity[], number]> {
    const qb = this.createQueryBuilder(this.metadata.tableName);
    if (options) {
      qb.setFindOptions(options); // Apply options (where, relations, etc.)
    }
    return qb.getManyAndCount();
  }

  // Find by ID with tenantId applied
  async findById(id: string): Promise<Entity | null> {
    console.log({ id }, 'logging');

    const resp = await this.createQueryBuilder(this.metadata.tableName)
      .andWhere('id = :id', { id })
      .getOne();

    console.log({ resp }, 'logging');
    return resp;
  }
  // Save method with automatic tenantId application
  async save(entity: any): Promise<any> {
    if (!entity.tenantId) {
      entity.tenantId = this.tenantId; // Automatically assign tenantId if not provided
    }
    return super.save(entity);
  }

  // Update method with automatic tenantId application
  async update(id: string, entity: any): Promise<any> {
    const qb = this.createQueryBuilder(this.metadata.tableName);
    qb.andWhere('id = :id', { id });
    qb.andWhere(`${qb.alias}.tenantId = :tenantId`, {
      tenantId: this.tenantId,
    });
    return qb.update().set(entity).execute();
  }

  // Delete method with automatic tenantId application
  async delete(id: string): Promise<any> {
    const qb = this.createQueryBuilder(this.metadata.tableName);
    qb.andWhere('id = :id', { id });
    qb.andWhere(`${qb.alias}.tenantId = :tenantId`, {
      tenantId: this.tenantId,
    });
    return qb.delete().execute();
  }
}

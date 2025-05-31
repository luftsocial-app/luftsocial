import {
  Repository,
  FindManyOptions,
  Like,
  In,
  Not,
  FindOptionsOrder,
  FindOneOptions,
} from 'typeorm';

export class BaseRepository<T> extends Repository<T> {
  /**
   * Helper to parse advanced where/filter operators in a convenient way.
   *
   * Where usage example:
   *    where: {
   *      firstName: 'Bill',
   *      lastName_not: 'Gates',
   *      companyName_like: '%Micro%',
   *      status_in: 'Millionaire,Billionaire'
   *    }
   *
   * Supported suffixes:
   *   - _like  → SQL LIKE (wildcards allowed)
   *   - _in    → SQL IN (comma-separated list)
   *   - _not   → SQL NOT EQUAL
   *
   * Example for fetchAll/fetchOne:
   *    await repo.fetchAll(
   *      { firstName: 'Bill', lastName_not: 'Gates', companyName_like: '%Micro%', status_in: 'Millionaire,Billionaire' }
   *    );
   */
  protected parseWhere(query: Record<string, any>) {
    const where: Record<string, any> = {};
    for (const key in query) {
      if (key.endsWith('_like')) {
        where[key.replace('_like', '')] = Like(`%${query[key]}%`);
      } else if (key.endsWith('_in')) {
        where[key.replace('_in', '')] = In(query[key].split(','));
      } else if (key.endsWith('_not')) {
        where[key.replace('_not', '')] = Not(query[key]);
      } else {
        where[key] = query[key];
      }
    }
    return where;
  }

  /**
   * Fetch multiple entities with advanced filtering, ordering, pagination, and relations.
   * @param rawWhere See usage example in parseWhere JSDoc.
   * @param options { select, relations, order, limit, page }
   */
  async fetchAll(
    rawWhere: any = {},
    {
      select,
      relations,
      order,
      limit,
      page = 1,
    }: {
      select?: Array<keyof T>;
      relations?: string[];
      order?: FindOptionsOrder<T>;
      limit?: number;
      page?: number;
    } = {},
  ) {
    const where = this.parseWhere(rawWhere);

    const options: FindManyOptions<T> = {
      where,
      order,
      relations,
    };

    if (select) options.select = select as any;
    if (limit) {
      options.take = limit;
      options.skip = (page - 1) * limit;
    }

    const [data, count] = await this.findAndCount(options);

    return {
      data,
      pagination: limit
        ? {
            limit,
            page,
            pages: Math.ceil(count / limit),
            rows: count,
          }
        : undefined,
    };
  }

  /**
   * Fetch a single entity with advanced filtering, ordering, and relations.
   * @param rawWhere See usage example in parseWhere JSDoc.
   * @param options { select, relations, order }
   */

  // FetchOne
  async fetchOne(
    rawWhere: any = {},
    {
      select,
      relations,
      order,
    }: {
      select?: Array<keyof T>;
      relations?: string[];
      order?: FindOptionsOrder<T>;
    } = {},
  ): Promise<T | undefined> {
    const where = this.parseWhere(rawWhere);

    const options: FindOneOptions<T> = {
      where,
      order,
      relations,
    };

    if (select) options.select = select as any;

    return this.findOne(options);
  }
}

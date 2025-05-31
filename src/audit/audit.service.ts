import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { RecordAuditEventDto } from './helpers/record-audit-event.dto';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  /**
   * Records an audit event in the system
   */
  async recordAuditEvent(dto: RecordAuditEventDto): Promise<AuditLog> {
    try {
      const auditLog = this.auditLogRepository.create({
        entityType: dto.entityType,
        entityId: dto.entityId,
        action: dto.action,
        userId: dto.userId,
        organizationId: dto.organizationId,
        tenantId: dto.tenantId,
        metadata: dto.metadata || {},
      });

      return this.auditLogRepository.save(auditLog);
    } catch (error) {
      // Log error but don't fail the main operation
      this.logger.error(
        `Failed to record audit event for ${dto.entityType} ${dto.entityId}: ${error.message}`,
        error.stack,
      );

      // Return a partial object with essential data
      return {
        id: 'error',
        entityType: dto.entityType,
        entityId: dto.entityId,
        action: dto.action,
        userId: dto.userId,
        organizationId: dto.organizationId,
        tenantId: dto.tenantId,
        metadata: dto.metadata || {},
        createdAt: new Date(),
      } as AuditLog;
    }
  }

  /**
   * Get audit logs for a specific entity
   */
  async getEntityAuditLogs(
    entityType: string,
    entityId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const [logs, total] = await this.auditLogRepository.findAndCount({
      where: { entityType, entityId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { logs, total };
  }

  /**
   * Get audit logs for a team
   */
  async getTeamAuditLogs(
    teamId: string,
    entityType?: string,
    action?: string,
    userId?: string,
    startDate?: Date,
    endDate?: Date,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const queryBuilder = this.auditLogRepository
      .createQueryBuilder('audit')
      .where('audit.teamId = :teamId', { teamId });

    if (entityType) {
      queryBuilder.andWhere('audit.entityType = :entityType', { entityType });
    }

    if (action) {
      queryBuilder.andWhere('audit.action = :action', { action });
    }

    if (userId) {
      queryBuilder.andWhere('audit.userId = :userId', { userId });
    }

    if (startDate) {
      queryBuilder.andWhere('audit.createdAt >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('audit.createdAt <= :endDate', { endDate });
    }

    queryBuilder
      .orderBy('audit.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [logs, total] = await queryBuilder.getManyAndCount();

    return { logs, total };
  }
}

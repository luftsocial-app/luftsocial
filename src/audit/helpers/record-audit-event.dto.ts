export interface RecordAuditEventDto {
  entityType: string;
  entityId: string;
  action: string;
  userId: string;
  organizationId: string;
  tenantId: string;
  metadata?: Record<string, any>;
}

export interface ITenantUserOperation {
  userId: string;
  tenantId: string;
  operationType: 'ADD' | 'REMOVE' | 'UPDATE';
  userData?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    [key: string]: any;
  };
}

export interface IOperationResult {
  success: boolean;
  message: string;
  data?: any;
  error?: any;
}

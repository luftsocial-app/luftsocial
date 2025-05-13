export class PostNotFoundException extends Error {
  constructor(postId: string) {
    super(`Post with ID ${postId} not found`);
    this.name = 'PostNotFoundException';
  }
}

export class InvalidWorkflowTransitionException extends Error {
  constructor(postId: string, currentStatus: string, targetStatus: string) {
    super(
      `Invalid workflow transition for post ${postId}: ${currentStatus} -> ${targetStatus}`,
    );
    this.name = 'InvalidWorkflowTransitionException';
  }
}

export class UnauthorizedWorkflowActionException extends Error {
  constructor(action: string, userId: string) {
    super(`User ${userId} not authorized to perform ${action}`);
    this.name = 'UnauthorizedWorkflowActionException';
  }
}

export class WorkflowStepNotFoundException extends Error {
  constructor(stepId: string) {
    super(`Approval step with ID ${stepId} not found`);
    this.name = 'WorkflowStepNotFoundException';
  }
}

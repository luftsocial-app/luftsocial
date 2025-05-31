import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import {
  PostNotFoundException,
  InvalidWorkflowTransitionException,
  UnauthorizedWorkflowActionException,
  WorkflowStepNotFoundException,
} from './workflow-exceptions';

@Catch(
  PostNotFoundException,
  InvalidWorkflowTransitionException,
  UnauthorizedWorkflowActionException,
  WorkflowStepNotFoundException,
)
export class WorkflowExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;

    if (
      exception instanceof PostNotFoundException ||
      exception instanceof WorkflowStepNotFoundException
    ) {
      status = HttpStatus.NOT_FOUND;
    } else if (exception instanceof InvalidWorkflowTransitionException) {
      status = HttpStatus.BAD_REQUEST;
    } else if (exception instanceof UnauthorizedWorkflowActionException) {
      status = HttpStatus.FORBIDDEN;
    }

    response.status(status).json({
      statusCode: status,
      message: exception.message,
      error: exception.name,
      timestamp: new Date().toISOString(),
    });
  }
}

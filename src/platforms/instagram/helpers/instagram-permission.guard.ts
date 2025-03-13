import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { InstagramRepository } from '../repositories/instagram.repository';

@Injectable()
export class InstagramPermissionGuard implements CanActivate {
  constructor(private readonly instagramRepo: InstagramRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const accountId = request.params.accountId;

    if (!accountId) {
      return true;
    }

    const account = await this.instagramRepo.getAccountByUserId(accountId);
    if (!account || !account.socialAccount) {
      return false;
    }

    // Check if token is expired
    if (new Date() >= account.socialAccount.tokenExpiresAt) {
      return false;
    }

    request.instagramAccount = account;
    return true;
  }
}

import { Module, Global } from '@nestjs/common';
import { ClerkAuthGuard } from 'src/guards/clerk-auth.guard';

@Global()
@Module({
  providers: [ClerkAuthGuard],
  exports: [ClerkAuthGuard],
})
export class AuthModule {}

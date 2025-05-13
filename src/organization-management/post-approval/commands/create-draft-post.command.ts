import { CreateDraftPostDto } from '../helper/dto/create-draft-post.dto';

export class CreateDraftPostCommand {
  constructor(
    public readonly createDraftPostDto: CreateDraftPostDto,
    public readonly userId: string,
    public readonly organizationId: string,
    public readonly tenantId: string,
    public readonly files?: Express.Multer.File[],
  ) {}
}

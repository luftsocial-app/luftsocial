import { PublishPostDto } from '../helper/dto/publish-post.dto';

export class PublishPostCommand {
  constructor(
    public readonly postId: string,
    public readonly publishPostDto: PublishPostDto,
    public readonly userId: string,
    public readonly userRole: string,
    public readonly tenantId: string,
    public readonly files?: Express.Multer.File[],
  ) {}
}

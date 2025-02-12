import * as jwt from 'jsonwebtoken';

export class AuthHelper {
  private static readonly JWT_SECRET = 'test-secret';

  static generateTestToken(userId: string, role: string = 'user') {
    return jwt.sign(
      {
        sub: userId,
        email: 'test@example.com',
        role: role,
      },
      this.JWT_SECRET,
      { expiresIn: '1h' },
    );
  }

  static generateAdminToken() {
    return this.generateTestToken('admin-id', 'admin');
  }

  static generateUserToken() {
    return this.generateTestToken('user-id', 'user');
  }

  static verifyToken(token: string) {
    return jwt.verify(token, this.JWT_SECRET);
  }

  static generateGroupMemberToken(
    userId: string,
    groupId: string,
    role: string,
  ) {
    return jwt.sign(
      {
        sub: userId,
        email: `${userId}@example.com`,
        role: role,
        groupId: groupId,
        groupRole: role,
      },
      this.JWT_SECRET,
      { expiresIn: '1h' },
    );
  }

  static generateGroupOwnerToken(groupId: string) {
    return this.generateGroupMemberToken('owner-id', groupId, 'owner');
  }

  static generateGroupModeratorToken(groupId: string) {
    return this.generateGroupMemberToken('mod-id', groupId, 'moderator');
  }
}

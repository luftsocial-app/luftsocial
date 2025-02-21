export interface ClerkUser {
  id: string;
  firstName?: string;
  lastName?: string;
  emailAddresses?: string[];
  imageUrl?: string;
  // Add other Clerk user properties as needed
}

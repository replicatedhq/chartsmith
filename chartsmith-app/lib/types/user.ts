export interface UserAdmin {
  id: string;
  email: string;
  name: string;
  imageUrl: string;
  createdAt: Date;
  lastLoginAt?: Date;
  lastActiveAt?: Date;
  isWaitlisted: boolean;
  isAdmin?: boolean;

  workspaceCount: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  imageUrl: string;
  createdAt: Date;
  lastLoginAt?: Date;
  lastActiveAt?: Date;
  isWaitlisted: boolean;
  isAdmin?: boolean;

  settings: UserSetting;
}

export interface UserSetting {
  automaticallyAcceptPatches: boolean;
  evalBeforeAccept: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  imageUrl: string;
  createdAt: Date;
  lastLoginAt?: Date;
  lastActiveAt?: Date;

  settings: UserSetting;
}

export interface UserSetting {
  automaticallyAcceptPatches: boolean;
  evalBeforeAccept: boolean;
}

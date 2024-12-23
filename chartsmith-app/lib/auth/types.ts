export interface GoogleAuthConfig {
  clientId: string
  redirectUri: string
}

export interface GoogleAuthUrlOptions {
  scopes?: string[]
  accessType?: 'online' | 'offline'
  prompt?: 'none' | 'consent' | 'select_account'
}

export interface GoogleUserProfile {
  id: string
  email: string
  name: string
  picture: string
  verified_email: boolean
}

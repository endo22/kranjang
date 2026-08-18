export type AuthUserDto = {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  emailVerifiedAt: string | null;
};

export type AuthTenantDto = {
  id: string;
  name: string;
  slug: string;
  subscriptionStatus: string;
  trialEndDate: string;
};

export type AuthResult = {
  user: AuthUserDto;
  tenant: AuthTenantDto;
  accessToken: string;
  refreshPlain: string;
};

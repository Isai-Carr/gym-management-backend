import { SetMetadata } from '@nestjs/common';

export const ALLOW_MUST_CHANGE_PASSWORD_KEY = 'allowMustChangePassword';

// Marks a route as reachable even when the authenticated user still has
// mustChangePassword set — used for the routes that let them clear that flag
// (or log out) without unlocking the rest of the API first.
export const AllowMustChangePassword = () =>
  SetMetadata(ALLOW_MUST_CHANGE_PASSWORD_KEY, true);

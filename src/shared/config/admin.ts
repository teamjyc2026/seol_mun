/**
 * Hardcoded password gate for the admin dashboard.
 * Env override available via ADMIN_PASSWORD if you ever want to rotate.
 */
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'aitutor!';
export const ADMIN_COOKIE = 'seolmun_admin';
export const ADMIN_COOKIE_VALUE = 'ok';
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 12; // 12h

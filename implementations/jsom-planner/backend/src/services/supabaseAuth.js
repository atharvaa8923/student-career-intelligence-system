const { AppError } = require('../middleware/errorHandler');

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw AppError('Supabase Auth is not configured', 503);
  return { url: url.replace(/\/$/, ''), key };
}

async function request(path, { method = 'GET', token, body, form = false } = {}) {
  const { url, key } = config();
  const headers = { apikey: key };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = form ? 'application/x-www-form-urlencoded' : 'application/json';
  const response = await fetch(`${url}${path}`, { method, headers, body: body ? (form ? new URLSearchParams(body).toString() : JSON.stringify(body)) : undefined });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = AppError(data.msg || data.message || data.error_description || 'Authentication failed', response.status);
    error.code = data.error_code;
    throw error;
  }
  return data;
}

const signUp = (email, password, fullName) => request('/auth/v1/signup', { method: 'POST', body: { email, password, data: { full_name: fullName } } });
const signIn = (email, password) => request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
const refreshSession = refreshToken => request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: refreshToken } });
const getAuthUser = token => request('/auth/v1/user', { token });
const updatePassword = (token, password) => request('/auth/v1/user', { method: 'PUT', token, body: { password } });
const signOut = token => request('/auth/v1/logout?scope=local', { method: 'POST', token });
const enroll = token => request('/rest/v1/rpc/enroll_application', { method: 'POST', token, body: { target_application: 'jsom_planner' } });
const roles = token => request('/rest/v1/rpc/get_my_app_roles', { method: 'POST', token, body: {} });

module.exports = { signUp, signIn, refreshSession, getAuthUser, updatePassword, signOut, enroll, roles };

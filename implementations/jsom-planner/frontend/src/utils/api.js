import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
});

// Attach JWT on every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('jsom_token');
  if (token) config.headers.Authorization = 'Bearer ' + (token);
  return config;
});

let refreshPromise = null;

// Refresh a Supabase session once, then replay requests that failed together.
api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config;
    if (err.response?.status === 401 && !original?._retried && !original?.url?.includes('/auth/refresh')) {
      const refreshToken = localStorage.getItem('jsom_refresh_token');
      if (refreshToken) {
        original._retried = true;
        refreshPromise ||= axios.post('/api/auth/refresh', { refreshToken }).finally(() => { refreshPromise = null; });
        try {
          const refreshed = await refreshPromise;
          localStorage.setItem('jsom_token', refreshed.data.token);
          localStorage.setItem('jsom_refresh_token', refreshed.data.refreshToken);
          original.headers.Authorization = `Bearer ${refreshed.data.token}`;
          return api(original);
        } catch { /* fall through to sign-out */ }
      }
      localStorage.removeItem('jsom_token');
      localStorage.removeItem('jsom_refresh_token');
      localStorage.removeItem('jsom_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// ── Auth ─────────────────────────────────────────────────────
export const authAPI = {
  login:          (data)  => api.post('/auth/login', data),
  register:       (data)  => api.post('/auth/register', data),
  refresh:        (refreshToken) => api.post('/auth/refresh', { refreshToken }),
  logout:         () => api.post('/auth/logout'),
  me:             ()      => api.get('/auth/me'),
  changePassword: (data)  => api.post('/auth/change-password', data),
};

// ── Programs ─────────────────────────────────────────────────
export const programsAPI = {
  list:                   (params) => api.get('/programs', { params }),
  get:                    (id)     => api.get('/programs/' + (id)),
  update:                 (id, d)  => api.put('/programs/' + (id), d),
  addCoreCourse:          (id, d)  => api.post('/programs/' + (id) + '/core-courses', d),
  removeCoreCourse:       (id, cId)=> api.delete('/programs/' + (id) + '/core-courses/' + (cId)),
  addConcentration:       (id, d)  => api.post('/programs/' + (id) + '/concentrations', d),
  updateConcentration:    (pId, cId, d) => api.put('/programs/' + (pId) + '/concentrations/' + (cId), d),
  deleteConcentration:    (pId, cId)   => api.delete('/programs/' + (pId) + '/concentrations/' + (cId)),
  addConcCourse:          (pId, cId, d)      => api.post('/programs/' + (pId) + '/concentrations/' + (cId) + '/courses', d),
  removeConcCourse:       (pId, cId, courseId) => api.delete('/programs/' + (pId) + '/concentrations/' + (cId) + '/courses/' + (courseId)),
};

// ── Courses ──────────────────────────────────────────────────
export const coursesAPI = {
  list:           (params) => api.get('/courses', { params }),
  subjects:       (params) => api.get('/courses/subjects', { params }),
  get:            (id)     => api.get('/courses/' + (id)),
  prereqChain:    (id)     => api.get('/courses/' + (id) + '/prereq-chain'),
  create:         (d)      => api.post('/courses', d),
  update:         (id, d)  => api.put('/courses/' + (id), d),
  addPrereq:      (id, d)  => api.post('/courses/' + (id) + '/prerequisites', d),
  removePrereq:   (id, rId)=> api.delete('/courses/' + (id) + '/prerequisites/' + (rId)),
};

// ── Students ─────────────────────────────────────────────────
export const studentsAPI = {
  dashboard:       ()       => api.get('/students/dashboard'),
  courses:         (params) => api.get('/students/courses', { params }),
  addCourse:       (d)      => api.post('/students/courses', d),
  updateCourse:    (id, d)  => api.patch('/students/courses/' + (id), d),
  removeCourse:    (id)     => api.delete('/students/courses/' + (id)),
  checkPrereqs:    (courseId) => api.get('/students/check-prerequisites/' + (courseId)),
  eligibleCourses: ()       => api.get('/students/eligible-courses'),
  updateProfile:   (d)      => api.put('/students/profile', d),
};

// ── Schedule ─────────────────────────────────────────────────
export const scheduleAPI = {
  get:      (params) => api.get('/schedule', { params }),
  sections: (cId, params) => api.get('/schedule/sections/' + (cId), { params }),
  enroll:   (d)      => api.post('/schedule/enroll', d),
};

// ── Admin ────────────────────────────────────────────────────
export const adminAPI = {
  stats:        ()           => api.get('/admin/stats'),
  students:     (params)     => api.get('/admin/students', { params }),
  createUser:   (d)          => api.post('/admin/users', d),
  toggleActive: (id)         => api.patch('/admin/users/' + (id) + '/toggle-active'),
  auditLog:     (params)     => api.get('/admin/audit-log', { params }),
  graphStats:   ()           => api.get('/admin/graph/stats'),
  refreshGraph: ()           => api.post('/admin/graph/refresh'),
  bulkUpdateCourses: (d)     => api.post('/admin/courses/bulk-update', d),
};

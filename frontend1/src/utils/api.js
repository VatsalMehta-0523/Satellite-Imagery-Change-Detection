import axios from 'axios';

export const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:8000' : '';
export const SOCKET_URL = API_BASE_URL ? API_BASE_URL.replace('http', 'ws') : `ws://${window.location.host}`;

export const getImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
};

const api = axios.create({ baseURL: '/api' });

export const fetchAPI = {
  getContext: (data) => api.post('/fetch/context', data),
  startFetch: (data) => api.post('/fetch/start', data),
  getStatus: (projectId) => api.get(`/fetch/status/${projectId}`),
  getProject: (projectId) => api.get(`/fetch/project/${projectId}`),
  listProjects: () => api.get('/fetch/projects'),
  getCDResult: (projectId) => api.get(`/change-detection/result/${projectId}`),
  detectChanges: (projectId) => api.post(`/fetch/detect-changes/${projectId}`),
  getValidDates: (bbox, year) => api.get(`/fetch/valid-dates?bbox=${bbox}&year=${year}`),
};

export const changeDetectionAPI = {
  run: (projectId) => api.post('/change-detection/run', { project_id: projectId }),
  getResult: (projectId) => api.get(`/change-detection/result/${projectId}`),
};

export const indicesAPI = {
  get: (projectId) => api.get(`/indices/${projectId}`),
};

export const complianceAPI = {
  list: (projectId) => api.get(`/compliance/${projectId}`),
  listAll: () => api.get('/compliance/all'),
  add: (data) => api.post('/compliance/', data),
  update: (id, data) => api.put(`/compliance/${id}`, data),
  delete: (id) => api.delete(`/compliance/${id}`),
};

export const insightsAPI = {
  generate: (data) => api.post('/insights/generate', data),
  downloadReport: (projectId) => api.get(`/reports/mission/${projectId}`, { responseType: 'blob' }),
};

export default api;

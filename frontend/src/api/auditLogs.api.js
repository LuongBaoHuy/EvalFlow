import API from './axiosClient';

export const getAuditLogsApi = async (params = {}) => {
  const response = await API.get('/audit-logs', { params });
  return response.data;
};

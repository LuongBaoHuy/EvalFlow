import axiosClient from './axiosClient';

export const getRolesApi = async () => {
  const response = await axiosClient.get('/users/roles');
  return response.data;
};

export const getUsersApi = async (params = {}) => {
  const response = await axiosClient.get('/users', { params });
  return response.data;
};

export const createUserApi = async (payload) => {
  const response = await axiosClient.post('/users', payload);
  return response.data;
};

export const updateUserApi = async (id, payload) => {
  const response = await axiosClient.put(`/users/${id}`, payload);
  return response.data;
};

export const deleteUserApi = async (id) => {
  const response = await axiosClient.delete(`/users/${id}`);
  return response.data;
};

export const toggleLockUserApi = async (id) => {
  const response = await axiosClient.patch(`/users/${id}/toggle-lock`);
  return response.data;
};

export const bulkImportUsersApi = async (usersList) => {
  const response = await axiosClient.post('/users/bulk-import', usersList);
  return response.data;
};

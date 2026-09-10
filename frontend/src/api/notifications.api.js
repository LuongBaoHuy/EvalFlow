import axiosClient from './axiosClient';

export const getNotificationsApi = async (userId) => {
  const response = await axiosClient.get('/notifications', { params: { user_id: userId } });
  return response.data;
};

export const markAllNotificationsReadApi = async (userId) => {
  const response = await axiosClient.put('/notifications/read-all', { user_id: userId }, { params: { user_id: userId } });
  return response.data;
};

export const markNotificationReadApi = async (id, userId) => {
  const response = await axiosClient.put(`/notifications/${id}/read`, { user_id: userId }, { params: { user_id: userId } });
  return response.data;
};

export const deleteNotificationApi = async (id, userId) => {
  const response = await axiosClient.delete(`/notifications/${id}`, { params: { user_id: userId }, data: { user_id: userId } });
  return response.data;
};

export const clearReadNotificationsApi = async (userId) => {
  const response = await axiosClient.delete('/notifications/clear-read', { params: { user_id: userId }, data: { user_id: userId } });
  return response.data;
};

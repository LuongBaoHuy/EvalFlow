import axiosClient from './axiosClient';

export const getMyAssignmentsApi = async (userId) => {
  const response = await axiosClient.get('/assignments/my', { params: { user_id: userId } });
  return response.data;
};

export const getAssignmentByIdApi = async (id) => {
  const response = await axiosClient.get(`/assignments/${id}`);
  return response.data;
};

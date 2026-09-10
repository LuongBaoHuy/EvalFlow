import axiosClient from './axiosClient';

export const getAdminLecturersListApi = async () => {
  const response = await axiosClient.get('/admin/lecturers-with-evaluations');
  return response.data;
};

export const getAdminLecturerEvaluationsApi = async (targetId) => {
  const response = await axiosClient.get(`/admin/evaluations-by-target/${targetId}`);
  return response.data;
};

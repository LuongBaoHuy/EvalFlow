import axiosClient from './axiosClient';

export const getMyEvaluationsApi = async () => {
  const response = await axiosClient.get('/lecturer/my-evaluations');
  return response.data;
};

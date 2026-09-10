import axiosClient from './axiosClient';

export const submitResponseApi = async (payload) => {
  const response = await axiosClient.post('/responses/submit', payload);
  return response.data;
};

import axiosClient from './axiosClient';

export const loginApi = async (email, password) => {
  const response = await axiosClient.post('/auth/login', { email, password });
  return response.data;
};

export const googleLoginApi = async (payload) => {
  const response = await axiosClient.post('/auth/google', payload);
  return response.data;
};

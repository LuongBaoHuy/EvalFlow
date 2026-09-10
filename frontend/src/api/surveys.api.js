import axiosClient from './axiosClient';

export const getSurveysApi = async (params = {}) => {
  const response = await axiosClient.get('/surveys', { params });
  return response.data;
};

export const getSurveyByIdApi = async (id) => {
  const response = await axiosClient.get(`/surveys/${id}`);
  return response.data;
};

export const createSurveyApi = async (data) => {
  const response = await axiosClient.post('/surveys', data);
  return response.data;
};

export const updateSurveyApi = async (id, data) => {
  const response = await axiosClient.put(`/surveys/${id}`, data);
  return response.data;
};

export const deleteSurveyApi = async (id) => {
  const response = await axiosClient.delete(`/surveys/${id}`);
  return response.data;
};

export const getTrashSurveysApi = async (params = {}) => {
  const response = await axiosClient.get('/surveys/trash', { params });
  return response.data;
};

export const restoreSurveyApi = async (id) => {
  const response = await axiosClient.put(`/surveys/${id}/restore`);
  return response.data;
};

export const forceDeleteSurveyApi = async (id) => {
  const response = await axiosClient.delete(`/surveys/${id}/force`);
  return response.data;
};

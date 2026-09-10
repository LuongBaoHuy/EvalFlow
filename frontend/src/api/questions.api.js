import axiosClient from './axiosClient';

export const getSurveyQuestionsApi = async (surveyId) => {
  const response = await axiosClient.get(`/surveys/${surveyId}/questions`);
  return response.data;
};

export const getQuestionByIdApi = async (id) => {
  const response = await axiosClient.get(`/questions/${id}`);
  return response.data;
};

export const createQuestionApi = async (surveyId, data) => {
  const response = await axiosClient.post(`/surveys/${surveyId}/questions`, data);
  return response.data;
};

export const updateQuestionApi = async (id, data) => {
  const response = await axiosClient.put(`/questions/${id}`, data);
  return response.data;
};

export const deleteQuestionApi = async (id) => {
  const response = await axiosClient.delete(`/questions/${id}`);
  return response.data;
};

export const replaceQuestionsBatchApi = async (surveyId, questions) => {
  const response = await axiosClient.post(`/surveys/${surveyId}/questions/batch`, { questions });
  return response.data;
};

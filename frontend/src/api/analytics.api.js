import axiosClient from './axiosClient';

export const getAnalyticsOverviewApi = async (params = {}) => {
  const response = await axiosClient.get('/analytics/overview', { params });
  return response.data;
};

export const getSurveyAnalyticsApi = async (surveyId) => {
  const response = await axiosClient.get(`/analytics/surveys/${surveyId}`);
  return response.data;
};

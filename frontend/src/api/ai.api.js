import axiosClient from './axiosClient';

export const generateFormApi = async (payload) => {
  const response = await axiosClient.post('/ai/generate-form', payload);
  return response.data;
};

export const appendQuestionsApi = async (payload) => {
  const response = await axiosClient.post('/ai/append-questions', payload);
  return response.data;
};

export const copilotChatApi = async (payload) => {
  const response = await axiosClient.post('/ai/copilot', payload);
  return response.data;
};

export const analyzeGoalsApi = async (campaignId) => {
  const response = await axiosClient.post('/ai/analyze-goals', { campaign_id: campaignId });
  return response.data;
};

export const getSavedAiGoalsResultApi = async (campaignId) => {
  const response = await axiosClient.get(`/campaigns/${campaignId}/ai-goals-result`);
  return response.data;
};

import axiosClient from './axiosClient';

export const getCampaignsApi = async (params = {}) => {
  const response = await axiosClient.get('/campaigns', { params });
  return response.data;
};

export const getCampaignByIdApi = async (id) => {
  const response = await axiosClient.get(`/campaigns/${id}`);
  return response.data;
};

export const createCampaignApi = async (data, isFormData = false) => {
  if (isFormData) {
    const response = await axiosClient.post('/campaigns', data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }
  const response = await axiosClient.post('/campaigns', data);
  return response.data;
};

export const updateCampaignApi = async (id, data) => {
  const response = await axiosClient.put(`/campaigns/${id}`, data);
  return response.data;
};

export const toggleCampaignStatusApi = async (id, is_active) => {
  const response = await axiosClient.patch(`/campaigns/${id}/status`, { is_active });
  return response.data;
};

export const deleteCampaignApi = async (id) => {
  const response = await axiosClient.delete(`/campaigns/${id}`);
  return response.data;
};

export const getTrashCampaignsApi = async (params = {}) => {
  const response = await axiosClient.get('/campaigns/trash', { params });
  return response.data;
};

export const restoreCampaignApi = async (id) => {
  const response = await axiosClient.put(`/campaigns/${id}/restore`);
  return response.data;
};

export const forceDeleteCampaignApi = async (id) => {
  const response = await axiosClient.delete(`/campaigns/${id}/force`);
  return response.data;
};

export const getCampaignAnalyticsApi = async (id, stepOrder = null) => {
  const params = {};
  if (stepOrder !== null) params.stepOrder = stepOrder;
  const response = await axiosClient.get(`/campaigns/${id}/analytics`, { params });
  return response.data;
};

export const getCampaignTrackingApi = async (id, params = {}) => {
  const response = await axiosClient.get(`/campaigns/${id}/tracking`, { params });
  return response.data;
};

export const getCampaignResponsesApi = async (id, params = {}) => {
  const response = await axiosClient.get(`/campaigns/${id}/responses`, { params });
  return response.data;
};

export const exportCampaignExcelApi = async (id) => {
  const response = await axiosClient.get(`/campaigns/${id}/export-excel`, {
    responseType: 'blob',
  });
  return response;
};

export const downloadCampaignTemplateApi = async () => {
  const response = await axiosClient.get('/campaigns/template-excel', {
    responseType: 'blob',
  });
  return response;
};

export const getMyAssignmentsInCampaignApi = async (campaignId, userId) => {
  const params = {};
  if (userId) params.user_id = userId;
  const response = await axiosClient.get(`/campaigns/${campaignId}/my-assignments`, { params });
  return response.data;
};

export const skipRemainingCampaignAssignmentsApi = async (campaignId, userId) => {
  const response = await axiosClient.put(`/campaigns/${campaignId}/skip-remaining`, {
    user_id: userId,
  });
  return response.data;
};

export const sendCopilotMessageApi = async (campaignId, message, history = []) => {
  const response = await axiosClient.post(`/campaigns/${campaignId}/chat`, {
    message,
    history,
  });
  return response.data;
};

export const downloadAssignmentFileApi = async (campaignId) => {
  const response = await axiosClient.get(`/campaigns/${campaignId}/assignment-file`, {
    responseType: 'blob',
  });
  return response;
};

export const downloadFileByUrlApi = async (fileUrl) => {
  const response = await axiosClient.get(fileUrl, {
    responseType: 'blob',
  });
  return response;
};

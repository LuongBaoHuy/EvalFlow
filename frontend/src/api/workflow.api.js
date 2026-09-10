import axiosClient from './axiosClient';

// Lấy cấu hình workflow của một campaign
export const getWorkflowConfigApi = async (campaignId) => {
  const response = await axiosClient.get(`/campaigns/${campaignId}/workflow-config`);
  return response.data;
};

// Lấy trạng thái workflow + timeline của một response
export const getWorkflowStatusApi = async (responseId) => {
  const response = await axiosClient.get(`/responses/${responseId}/workflow`);
  return response.data;
};

// Lấy dữ liệu câu trả lời gốc + lịch sử review để đối chiếu
export const getResponseAnswersForReviewApi = async (responseId) => {
  const response = await axiosClient.get(`/responses/${responseId}/review-data`);
  return response.data;
};

// Nộp đánh giá (chấm điểm) tại một bước
export const submitReviewApi = async (responseId, payload) => {
  // payload: { reviewed_data, note, action: 'APPROVED' | 'REJECTED' }
  const response = await axiosClient.post(`/responses/${responseId}/review`, payload);
  return response.data;
};

// Lấy danh sách phiếu đang chờ user duyệt
export const getMyPendingReviewsApi = async (params = {}) => {
  const response = await axiosClient.get('/workflow/pending', { params });
  return response.data;
};

// Đếm số phiếu đang chờ user duyệt (cho badge)
export const countMyPendingReviewsApi = async (userId) => {
  const params = userId ? { user_id: userId } : {};
  const response = await axiosClient.get('/workflow/pending/count', { params });
  return response.data;
};
// Lấy danh sách chiến dịch mà user đã từng duyệt
export const getMyReviewedCampaignsApi = async () => {
  const response = await axiosClient.get('/workflow/reviewed-campaigns');
  return response.data;
};

// Lấy danh sách phiếu đã duyệt trong một chiến dịch
export const getReviewedResponsesInCampaignApi = async (campaignId, params = {}) => {
  const response = await axiosClient.get(`/workflow/reviewed-campaigns/${campaignId}/responses`, { params });
  return response.data;
};

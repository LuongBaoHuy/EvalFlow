import axiosClient from './axiosClient';

export const uploadImageApi = async (file) => {
  const formData = new FormData();
  formData.append('image', file);

  const response = await axiosClient.post('/uploads/image', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const uploadFileApi = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await axiosClient.post('/uploads/file', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

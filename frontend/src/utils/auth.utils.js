const TOKEN_KEY = 'evalflow_token';
const USER_KEY = 'evalflow_user';

export const saveAuth = (token, user) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const getToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

export const getUser = () => {
  const user = localStorage.getItem(USER_KEY);
  return user ? JSON.parse(user) : null;
};

export const clearAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  try {
    sessionStorage.removeItem('last_survey_url');
  } catch (e) {}
};

export const isAuthenticated = () => {
  return !!getToken();
};

export const getUserRole = () => {
  const user = getUser();
  return user?.role_name || null;
};

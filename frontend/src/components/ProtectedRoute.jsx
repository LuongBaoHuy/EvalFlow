import { Navigate, useLocation } from 'react-router-dom';
import { isAuthenticated, getUser } from '../utils/auth.utils';

const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const authed = isAuthenticated();

  const user = getUser();

  const isDoingSurvey = location.pathname.startsWith('/surveys/do/') || location.pathname.startsWith('/do-survey/');
  if (isDoingSurvey) {
    try {
      sessionStorage.setItem('last_survey_url', location.pathname + location.search);
    } catch (e) {}
  }

  if (!authed) {
    const redirectUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirectUrl}`} replace />;
  }

  if (user?.role_name === 'PublicGuest') {
    if (!isDoingSurvey) {
      const savedUrl = sessionStorage.getItem('last_survey_url');
      if (savedUrl && savedUrl !== location.pathname) {
        return <Navigate to={savedUrl} replace />;
      }
      return <Navigate to="/login" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;

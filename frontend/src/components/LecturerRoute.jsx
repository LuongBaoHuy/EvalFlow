import { Navigate } from 'react-router-dom';
import { isAuthenticated, getUserRole } from '../utils/auth.utils';

const LecturerRoute = ({ children }) => {
  const authed = isAuthenticated();
  const role = getUserRole();

  if (!authed) {
    return <Navigate to="/login" replace />;
  }

  if (role !== 'Giảng viên' && role !== 'Admin') {
    return <Navigate to="/my-surveys" replace />;
  }

  return children;
};

export default LecturerRoute;

import { Navigate } from 'react-router-dom';
import { isAuthenticated, getUserRole } from '../utils/auth.utils';

const AdminRoute = ({ children }) => {
  const authed = isAuthenticated();
  const role = getUserRole();

  if (!authed) {
    return <Navigate to="/login" replace />;
  }

  if (role !== 'Admin') {
    return <Navigate to="/my-surveys" replace />;
  }

  return children;
};

export default AdminRoute;

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import Login from './pages/Login.jsx';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AdminRoute from './components/AdminRoute.jsx';
import LecturerRoute from './components/LecturerRoute.jsx';
import ReviewerRoute from './components/ReviewerRoute.jsx';
import SurveysList from './pages/admin/SurveysList.jsx';
import SurveyEditor from './pages/admin/SurveyEditor.jsx';
import CampaignsList from './pages/admin/CampaignsList.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import SurveyReport from './pages/admin/SurveyReport.jsx';
import CampaignResults from './pages/admin/CampaignResults.jsx';
import MySurveys from './pages/student/MySurveys.jsx';
import DoSurveyPage from './pages/student/DoSurveyPage.jsx';
import CampaignDetailSelection from './pages/student/CampaignDetailSelection.jsx';
import UsersList from './pages/admin/UsersList.jsx';
import LecturerDashboard from './pages/lecturer/LecturerDashboard.jsx';
import AdminLecturerDashboard from './pages/admin/AdminLecturerDashboard.jsx';
import AuditLogs from './pages/admin/AuditLogs.jsx';
import MyPendingReviews from './pages/MyPendingReviews.jsx';
import WorkflowReviewPage from './pages/WorkflowReviewPage.jsx';
import { MyReviewedCampaigns, MyReviewedCampaignDetail } from './pages/MyReviewedPage.jsx';

function App() {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'GOOGLE_CLIENT_ID_PLACEHOLDER';

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <Router>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/" element={<Navigate to="/my-surveys" replace />} />
          <Route path="/my-surveys" element={<MySurveys />} />
          <Route path="/my-surveys/campaign/:campaignId" element={<CampaignDetailSelection />} />
          <Route path="/student/campaigns/:campaignId" element={<CampaignDetailSelection />} />
          <Route path="/surveys/do/:campaignId" element={<DoSurveyPage />} />
          <Route path="/survey/:campaignId" element={<DoSurveyPage />} />
          <Route path="/do-survey/:assignmentId" element={<DoSurveyPage />} />
          <Route
            path="/my-pending-reviews"
            element={
              <ReviewerRoute>
                <MyPendingReviews />
              </ReviewerRoute>
            }
          />
          <Route
            path="/my-reviewed"
            element={
              <ReviewerRoute>
                <MyReviewedCampaigns />
              </ReviewerRoute>
            }
          />
          <Route
            path="/my-reviewed/:campaignId"
            element={
              <ReviewerRoute>
                <MyReviewedCampaignDetail />
              </ReviewerRoute>
            }
          />
          <Route
            path="/workflow/review/:responseId"
            element={
              <ReviewerRoute>
                <WorkflowReviewPage />
              </ReviewerRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/surveys"
            element={
              <AdminRoute>
                <SurveysList />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/surveys/create"
            element={
              <AdminRoute>
                <SurveyEditor />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/surveys/edit/:id"
            element={
              <AdminRoute>
                <SurveyEditor />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/campaigns"
            element={
              <AdminRoute>
                <CampaignsList />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/campaigns/:id/results"
            element={
              <AdminRoute>
                <CampaignResults />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/analytics/:surveyId"
            element={
              <AdminRoute>
                <SurveyReport />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AdminRoute>
                <UsersList />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/lecturer-evaluations"
            element={
              <AdminRoute>
                <AdminLecturerDashboard />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/audit-logs"
            element={
              <AdminRoute>
                <AuditLogs />
              </AdminRoute>
            }
          />
          <Route
            path="/lecturer"
            element={<Navigate to="/lecturer/dashboard" replace />}
          />
          <Route
            path="/lecturer/dashboard"
            element={
              <LecturerRoute>
                <LecturerDashboard />
              </LecturerRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
    </GoogleOAuthProvider>
  );
}

export default App;

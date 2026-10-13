import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import DemoPanel from './components/demo/DemoPanel';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/ui';
import ShellLayout from './components/shell/ShellLayout';
import FilesPage from './features/files/FilesPage';
import HomeLoanListPage from './features/master/HomeLoanListPage';
import WorkflowListPage from './features/workflow/WorkflowListPage';
import ReviewPage from './features/workflow/review/ReviewPage';
import ApplyPage from './pages/ApplyPage';
import ComponentsPage from './pages/ComponentsPage';
import DashboardPage from './pages/DashboardPage';
import NotInDemoPage from './pages/NotInDemoPage';

export default function App() {
  const { pathname } = useLocation();
  return (
    <ToastProvider>
      {/* The demo panel is outside the boundary, so its Reset demo still works if a page breaks */}
      <ErrorBoundary resetKey={pathname}>
        <Routes>
          {/* the shared master form keeps its own standalone layout: no sidebar, no top bar */}
          <Route path="/apply" element={<ApplyPage />} />
          {/* the review screen is a full-screen page too, with no shell around it */}
          <Route path="/workflow/review/:instanceId" element={<ReviewPage />} />

          {/* everything else is drawn inside the DMS+ shell */}
          <Route element={<ShellLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/files" element={<FilesPage />} />
            <Route path="/metadata/master/home-loan" element={<HomeLoanListPage />} />
            <Route path="/workflow" element={<WorkflowListPage />} />
            <Route path="/magic-folder" element={<NotInDemoPage title="Magic Folder" />} />
            <Route path="/favourite" element={<NotInDemoPage title="Favourite" />} />
            <Route path="/advance-search" element={<NotInDemoPage title="Advance Search" />} />
            <Route path="/reports" element={<NotInDemoPage title="Reports" />} />
            <Route path="/settings" element={<NotInDemoPage title="Settings" />} />
            <Route path="/bin" element={<NotInDemoPage title="Bin" />} />
            <Route path="/demo/components" element={<ComponentsPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </ErrorBoundary>
      <DemoPanel />
    </ToastProvider>
  );
}

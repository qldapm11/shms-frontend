import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './store/auth';
import { LoginPage } from './pages/Login';
import { AppLayout } from './layout/AppLayout';
import { DashboardPage } from './pages/Dashboard';
import { PatientsPage } from './pages/Patients';
import { ReceptionPage } from './pages/Reception';
import { DoctorQueuePage } from './pages/DoctorQueue';
import { EncounterExamPage } from './pages/EncounterExam';
import { BedsPage } from './pages/Beds';
import { PharmacyPage } from './pages/Pharmacy';
import { BillingPage } from './pages/Billing';
import { AdminUsersPage } from './pages/AdminUsers';
import { AdmissionsPage } from './pages/Admissions';
import { InpatientCarePage } from './pages/InpatientCare';
import { MedicalRecordPage } from './pages/MedicalRecord';
import { CatalogPage } from './pages/Catalog';
import { SystemConfigPage } from './pages/SystemConfig';
import { MonitoringPage } from './pages/Monitoring';
import { ReportsPage } from './pages/Reports';
import { NotificationsPage } from './pages/Notifications';
import { IoTMonitorPage } from './pages/IoTMonitor';
import { ResourcesPage } from './pages/Resources';
import { PortalPage } from './pages/Portal';
import { RolesPermissionsPage } from './pages/RolesPermissions';
import { AdvancedConfigPage } from './pages/AdvancedConfig';
import { PatientHistoryPage } from './pages/PatientHistory';
import { HubPage } from './pages/Hub';
import { SecurityPage } from './pages/Security';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token, user, loadMe, loading } = useAuth();
  useEffect(() => {
    if (token && !user) loadMe();
  }, [token, user, loadMe]);
  if (!token) return <Navigate to="/login" replace />;
  if (loading || !user) return null;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<DashboardPage />} />
        <Route path="patients" element={<PatientsPage />} />
        <Route path="reception" element={<ReceptionPage />} />
        <Route path="queue" element={<DoctorQueuePage />} />
        <Route path="encounters/:id" element={<EncounterExamPage />} />
        <Route path="medical-record" element={<MedicalRecordPage />} />
        <Route path="admissions" element={<AdmissionsPage />} />
        <Route path="inpatient-care" element={<InpatientCarePage />} />
        <Route path="beds" element={<BedsPage />} />
        <Route path="resources" element={<ResourcesPage />} />
        <Route path="iot" element={<IoTMonitorPage />} />
        <Route path="pharmacy" element={<PharmacyPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="portal" element={<PortalPage />} />
        <Route path="admin/users" element={<AdminUsersPage />} />
        <Route path="admin/catalog" element={<CatalogPage />} />
        <Route path="admin/config" element={<SystemConfigPage />} />
        <Route path="admin/monitoring" element={<MonitoringPage />} />
        <Route path="admin/roles" element={<RolesPermissionsPage />} />
        <Route path="admin/advanced" element={<AdvancedConfigPage />} />
        <Route path="patient-history" element={<PatientHistoryPage />} />
        <Route path="hub" element={<HubPage />} />
        <Route path="security" element={<SecurityPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

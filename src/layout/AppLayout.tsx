import { Layout, Menu, Dropdown, Avatar, Typography, Badge } from 'antd';
import {
  DashboardOutlined, TeamOutlined, SolutionOutlined, MedicineBoxOutlined,
  DollarOutlined, ApartmentOutlined, SettingOutlined, ProjectOutlined,
  UserOutlined, LogoutOutlined, UnorderedListOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/auth';

const { Header, Sider, Content } = Layout;

interface NavItem { key: string; icon: React.ReactNode; label: string; perm?: string }

const NAV: NavItem[] = [
  { key: '/', icon: <DashboardOutlined />, label: 'Tổng quan' },
  { key: '/reception', icon: <SolutionOutlined />, label: 'Tiếp đón', perm: 'patient.write' },
  { key: '/patients', icon: <TeamOutlined />, label: 'Người bệnh', perm: 'patient.read' },
  { key: '/queue', icon: <UnorderedListOutlined />, label: 'Hàng chờ khám', perm: 'encounter.read' },
  { key: '/beds', icon: <ApartmentOutlined />, label: 'Sơ đồ giường', perm: 'bed.read' },
  { key: '/pharmacy', icon: <MedicineBoxOutlined />, label: 'Dược', perm: 'pharmacy.read' },
  { key: '/billing', icon: <DollarOutlined />, label: 'Viện phí', perm: 'billing.read' },
  { key: '/admin/users', icon: <SettingOutlined />, label: 'Quản trị', perm: 'admin.users' },
  { key: '/hub', icon: <ProjectOutlined />, label: 'Project Hub', perm: 'hub.read' },
];

export function AppLayout() {
  const { user, logout, can } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const items = NAV.filter((n) => !n.perm || can(n.perm)).map((n) => ({
    key: n.key,
    icon: n.icon,
    label: n.label,
  }));

  const selected = NAV.map((n) => n.key)
    .filter((k) => k === '/' ? loc.pathname === '/' : loc.pathname.startsWith(k))
    .sort((a, b) => b.length - a.length)[0] || '/';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth="0" theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
        <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#1565c0', fontSize: 20 }}>
          SHMS
        </div>
        <Menu mode="inline" selectedKeys={[selected]} items={items} onClick={(e) => nav(e.key)} />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0' }}>
          <Typography.Text strong style={{ fontSize: 16 }}>Hệ thống Quản lý Bệnh viện Thông minh</Typography.Text>
          <Dropdown
            menu={{
              items: [
                { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', onClick: () => { logout(); nav('/login'); } },
              ],
            }}
          >
            <span style={{ cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} style={{ background: '#1565c0' }} /> <span style={{ marginLeft: 8 }}>{user?.fullName}</span>
            </span>
          </Dropdown>
        </Header>
        <Content style={{ margin: 16, padding: 20, background: '#fff', borderRadius: 8 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

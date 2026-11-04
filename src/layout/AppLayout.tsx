import { Layout, Menu, Dropdown, Avatar, Typography } from 'antd';
import {
  DashboardOutlined, TeamOutlined, SolutionOutlined, MedicineBoxOutlined,
  DollarOutlined, ApartmentOutlined, SettingOutlined, FileProtectOutlined,
  UserOutlined, LogoutOutlined, UnorderedListOutlined, HomeOutlined,
  BarChartOutlined, BellOutlined, HeartOutlined, ToolOutlined, BookOutlined,
  DatabaseOutlined, MonitorOutlined, SlidersOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/auth';

const { Header, Sider, Content } = Layout;

interface NavItem { key: string; icon: React.ReactNode; label: string; perm?: string }
interface NavGroup { key: string; label: string; icon: React.ReactNode; children: NavItem[] }

// Menu phân nhóm theo nghiệp vụ. Mục/nhóm chỉ hiện khi người dùng có quyền tương ứng.
const NAV: (NavItem | NavGroup)[] = [
  { key: '/', icon: <DashboardOutlined />, label: 'Tổng quan' },
  { key: '/portal', icon: <HeartOutlined />, label: 'Cổng của tôi', perm: 'patient.self' },
  {
    key: 'g-tiepdon', label: 'Tiếp đón & khám', icon: <SolutionOutlined />, children: [
      { key: '/reception', icon: <SolutionOutlined />, label: 'Tiếp đón', perm: 'patient.write' },
      { key: '/patients', icon: <TeamOutlined />, label: 'Người bệnh', perm: 'patient.read' },
      { key: '/queue', icon: <UnorderedListOutlined />, label: 'Hàng chờ khám', perm: 'encounter.read' },
      { key: '/medical-record', icon: <FileProtectOutlined />, label: 'Bệnh án', perm: 'emr.read' },
      { key: '/patient-history', icon: <FileProtectOutlined />, label: 'Lịch sử điều trị', perm: 'encounter.read' },
    ],
  },
  {
    key: 'g-noitru', label: 'Nội trú & nguồn lực', icon: <HomeOutlined />, children: [
      { key: '/admissions', icon: <HomeOutlined />, label: 'Nhập/xuất viện', perm: 'admission.write' },
      { key: '/inpatient-care', icon: <HeartOutlined />, label: 'Chăm sóc nội trú', perm: 'care.write' },
      { key: '/beds', icon: <ApartmentOutlined />, label: 'Sơ đồ giường', perm: 'bed.read' },
      { key: '/iot', icon: <MonitorOutlined />, label: 'Theo dõi IoT', perm: 'vitals.read' },
      { key: '/resources', icon: <ToolOutlined />, label: 'Thiết bị & lịch trực', perm: 'bed.read' },
    ],
  },
  {
    key: 'g-duocvp', label: 'Dược & viện phí', icon: <MedicineBoxOutlined />, children: [
      { key: '/pharmacy', icon: <MedicineBoxOutlined />, label: 'Dược', perm: 'pharmacy.read' },
      { key: '/billing', icon: <DollarOutlined />, label: 'Viện phí', perm: 'billing.read' },
    ],
  },
  {
    key: 'g-dhbc', label: 'Điều hành & báo cáo', icon: <BarChartOutlined />, children: [
      { key: '/reports', icon: <BarChartOutlined />, label: 'Báo cáo', perm: 'report.read' },
      { key: '/notifications', icon: <BellOutlined />, label: 'Thông báo' },
    ],
  },
  {
    key: 'g-quantri', label: 'Quản trị', icon: <SettingOutlined />, children: [
      { key: '/admin/users', icon: <UserOutlined />, label: 'Người dùng', perm: 'admin.users' },
      { key: '/admin/roles', icon: <UserOutlined />, label: 'Vai trò & nhập tài khoản', perm: 'admin.users' },
      { key: '/admin/catalog', icon: <DatabaseOutlined />, label: 'Danh mục', perm: 'admin.catalog' },
      { key: '/admin/config', icon: <SlidersOutlined />, label: 'Cấu hình', perm: 'admin.config' },
      { key: '/admin/advanced', icon: <SlidersOutlined />, label: 'Quy trình & sao lưu', perm: 'admin.config' },
      { key: '/admin/monitoring', icon: <MonitorOutlined />, label: 'Giám sát', perm: 'admin.monitor' },
    ],
  },
];

function isGroup(n: NavItem | NavGroup): n is NavGroup {
  return (n as NavGroup).children !== undefined;
}

export function AppLayout() {
  const { user, logout, can } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  // Lọc theo quyền; ẩn nhóm nếu không còn mục con nào.
  const items = NAV.map((n) => {
    if (!isGroup(n)) return !n.perm || can(n.perm) ? { key: n.key, icon: n.icon, label: n.label } : null;
    const kids = n.children.filter((c) => !c.perm || can(c.perm)).map((c) => ({ key: c.key, icon: c.icon, label: c.label }));
    return kids.length ? { key: n.key, icon: n.icon, label: n.label, children: kids } : null;
  }).filter(Boolean) as any[];

  const allKeys = NAV.flatMap((n) => (isGroup(n) ? n.children.map((c) => c.key) : [n.key]));
  const selected = allKeys
    .filter((k) => (k === '/' ? loc.pathname === '/' : loc.pathname.startsWith(k)))
    .sort((a, b) => b.length - a.length)[0] || '/';
  const openKeys = NAV.filter(isGroup).filter((g) => g.children.some((c) => loc.pathname.startsWith(c.key))).map((g) => g.key);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth="0" theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
        <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#1565c0', fontSize: 20 }}>
          SHMS
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selected]}
          defaultOpenKeys={openKeys}
          items={items}
          onClick={(e) => { if (e.key.startsWith('/')) nav(e.key); }}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0' }}>
          <Typography.Text strong style={{ fontSize: 16 }}>Hệ thống Quản lý Bệnh viện Thông minh</Typography.Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <a href="/shms/docs/" target="_blank" rel="noreferrer" style={{ color: '#1565c0' }}>
              <BookOutlined /> Tài liệu hướng dẫn
            </a>
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
          </div>
        </Header>
        <Content style={{ margin: 16, padding: 20, background: '#fff', borderRadius: 8 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

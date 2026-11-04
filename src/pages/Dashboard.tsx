import { Card, Col, Row, Statistic, Typography, Spin, Alert } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => (await api.get('/reports/dashboard')).data,
  });

  if (isLoading) return <Spin />;
  if (error) return <Alert type="error" message="Không tải được dashboard" />;

  const d = data || {};
  const enc = d.encounters?.byStatus || {};
  return (
    <div>
      <Typography.Title level={4}>Tổng quan</Typography.Title>
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}><Card><Statistic title="Người bệnh hôm nay" value={d.patients?.today ?? 0} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Lượt đang chờ" value={enc.WAITING ?? 0} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Giường trống" value={d.beds?.empty ?? 0} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Đơn chờ cấp phát" value={d.prescriptions?.pendingDispense ?? 0} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Giường đang dùng" value={d.beds?.occupied ?? 0} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Doanh thu hôm nay" value={d.revenue?.today ?? 0} suffix="đ" /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Tổng doanh thu" value={d.revenue?.total ?? 0} suffix="đ" /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Lượt đang khám" value={enc.IN_EXAM ?? 0} /></Card></Col>
      </Row>
      <Typography.Paragraph type="secondary" style={{ marginTop: 16 }}>
        Số liệu lấy trực tiếp từ dữ liệu demo trong hệ thống.
      </Typography.Paragraph>
    </div>
  );
}

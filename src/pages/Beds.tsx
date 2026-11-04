import { Card, Col, Row, Tag, Typography, Spin, Alert, Empty } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

interface Bed {
  id: string;
  code: string;
  status: 'EMPTY' | 'OCCUPIED' | 'RESERVED' | 'MAINT';
  departmentId: string | null;
  department?: { code?: string; name?: string } | null;
  patient?: { fullName?: string; code?: string } | null;
  admissionId?: string | null;
}

const STATUS_META: Record<Bed['status'], { color: string; label: string; bg: string; border: string }> = {
  EMPTY: { color: 'green', label: 'Trống', bg: '#f6ffed', border: '#b7eb8f' },
  OCCUPIED: { color: 'blue', label: 'Đang dùng', bg: '#e6f4ff', border: '#91caff' },
  RESERVED: { color: 'gold', label: 'Đã giữ', bg: '#fffbe6', border: '#ffe58f' },
  MAINT: { color: 'default', label: 'Bảo trì', bg: '#fafafa', border: '#d9d9d9' },
};

export function BedsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['beds'],
    queryFn: async () => (await api.get<Bed[]>('/beds')).data,
  });

  if (isLoading) return <Spin />;
  if (error) return <Alert type="error" message="Không tải được sơ đồ giường" />;

  const beds = data ?? [];
  if (!beds.length) return <Empty description="Chưa có giường" />;

  return (
    <div>
      <Typography.Title level={4}>Sơ đồ giường</Typography.Title>
      <Row gutter={[16, 16]}>
        {beds.map((b) => {
          const meta = STATUS_META[b.status] ?? STATUS_META.MAINT;
          return (
            <Col key={b.id} xs={12} sm={8} md={6} lg={4}>
              <Card
                size="small"
                style={{ background: meta.bg, borderColor: meta.border }}
                styles={{ body: { padding: 12 } }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Typography.Text strong>{b.code}</Typography.Text>
                  <Tag color={meta.color} style={{ marginInlineEnd: 0 }}>{meta.label}</Tag>
                </div>
                {b.department?.name && (
                  <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 4 }}>
                    {b.department.name}
                  </Typography.Paragraph>
                )}
                {b.status === 'OCCUPIED' && b.patient?.fullName ? (
                  <Typography.Text>{b.patient.fullName}</Typography.Text>
                ) : (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>—</Typography.Text>
                )}
              </Card>
            </Col>
          );
        })}
      </Row>
    </div>
  );
}

import { useState } from 'react';
import {
  Tabs, Table, Card, Col, Row, Statistic, Tag, Typography, Spin, Alert, Space,
} from 'antd';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

function is403(err: unknown): boolean {
  return axios.isAxiosError(err) && err.response?.status === 403;
}

function Forbidden() {
  return <Alert type="warning" showIcon message="Không đủ quyền" description="Bạn không có quyền giám sát hệ thống." />;
}

interface Health { status: string; users: number; patients: number; encounters: number; time: string; }
interface AuditLog {
  id: string; action: string; resource: string; resourceId: string | null;
  actorId: string | null; actorName?: string | null; createdAt: string;
}
interface Integration { id: string; type: string; name: string; status: string; mock?: boolean; }
interface SyncLog {
  id: string; status: string; direction?: string; message?: string | null; createdAt: string;
  integration?: { type: string; name: string };
}

const SYNC_COLOR: Record<string, string> = { OK: 'green', SUCCESS: 'green', FAILED: 'red', ERROR: 'red', PENDING: 'gold' };
const INT_COLOR: Record<string, string> = { ACTIVE: 'green', CONNECTED: 'green', INACTIVE: 'default', ERROR: 'red' };

// ---------------- Health ----------------
function HealthTab() {
  const q = useQuery({
    queryKey: ['monitor', 'health'],
    queryFn: async () => (await api.get('/admin/monitor/health')).data.data as Health,
  });

  if (is403(q.error)) return <Forbidden />;
  if (q.isLoading) return <Spin />;
  if (q.error) return <Alert type="error" message="Không tải được tình trạng hệ thống" />;

  const d = q.data as Health;
  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Typography.Text>Trạng thái:</Typography.Text>
        <Tag color={d.status === 'OK' ? 'green' : 'red'}>{d.status}</Tag>
        <Typography.Text type="secondary">Cập nhật: {new Date(d.time).toLocaleString('vi-VN')}</Typography.Text>
      </Space>
      <Row gutter={[16, 16]}>
        <Col xs={12} md={8}><Card><Statistic title="Người dùng" value={d.users} /></Card></Col>
        <Col xs={12} md={8}><Card><Statistic title="Người bệnh" value={d.patients} /></Card></Col>
        <Col xs={12} md={8}><Card><Statistic title="Lượt khám" value={d.encounters} /></Card></Col>
      </Row>
    </div>
  );
}

// ---------------- Audit ----------------
function AuditTab() {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);

  const q = useQuery({
    queryKey: ['monitor', 'audit', page, size],
    queryFn: async () => (await api.get('/admin/audit', { params: { page, size } })).data as {
      data: AuditLog[]; page: number; size: number; total: number;
    },
  });

  if (is403(q.error)) return <Forbidden />;
  if (q.error && !is403(q.error)) return <Alert type="error" message="Không tải được nhật ký audit" />;

  return (
    <Table
      rowKey="id"
      loading={q.isLoading}
      dataSource={q.data?.data ?? []}
      pagination={{
        current: page,
        pageSize: size,
        total: q.data?.total ?? 0,
        showSizeChanger: true,
        onChange: (p, s) => { setPage(p); setSize(s); },
      }}
      columns={[
        { title: 'Hành động', dataIndex: 'action' },
        { title: 'Đối tượng', render: (_, r: AuditLog) => `${r.resource}${r.resourceId ? ` #${r.resourceId}` : ''}` },
        { title: 'Người thực hiện', render: (_, r: AuditLog) => r.actorName ?? r.actorId ?? '-' },
        { title: 'Thời gian', dataIndex: 'createdAt', render: (v: string) => new Date(v).toLocaleString('vi-VN') },
      ]}
    />
  );
}

// ---------------- Integrations ----------------
function IntegrationsTab() {
  const integrations = useQuery({
    queryKey: ['monitor', 'integrations'],
    queryFn: async () => (await api.get('/admin/integrations')).data.data as Integration[],
  });
  const syncLogs = useQuery({
    queryKey: ['monitor', 'sync-logs'],
    queryFn: async () => (await api.get('/admin/sync-logs')).data.data as SyncLog[],
  });

  if (is403(integrations.error)) return <Forbidden />;
  if (integrations.error && !is403(integrations.error)) {
    return <Alert type="error" message="Không tải được danh sách tích hợp" />;
  }

  return (
    <div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Các tích hợp dưới đây là dữ liệu mô phỏng (MOCK), không kết nối hệ thống ngoài thực tế."
      />
      <Typography.Title level={5}>Tích hợp</Typography.Title>
      <Table
        rowKey="id"
        loading={integrations.isLoading}
        dataSource={integrations.data ?? []}
        pagination={false}
        style={{ marginBottom: 24 }}
        columns={[
          {
            title: 'Loại',
            dataIndex: 'type',
            render: (t: string) => <Space><span>{t}</span><Tag>MOCK</Tag></Space>,
          },
          { title: 'Tên', dataIndex: 'name' },
          {
            title: 'Trạng thái',
            dataIndex: 'status',
            render: (s: string) => <Tag color={INT_COLOR[s] ?? 'default'}>{s}</Tag>,
          },
        ]}
      />
      <Typography.Title level={5}>Nhật ký đồng bộ (mô phỏng)</Typography.Title>
      <Table
        rowKey="id"
        loading={syncLogs.isLoading}
        dataSource={syncLogs.data ?? []}
        pagination={{ pageSize: 10 }}
        columns={[
          { title: 'Tích hợp', render: (_, r: SyncLog) => r.integration ? `${r.integration.name} (${r.integration.type})` : '-' },
          {
            title: 'Trạng thái',
            dataIndex: 'status',
            render: (s: string) => <Tag color={SYNC_COLOR[s] ?? 'default'}>{s}</Tag>,
          },
          { title: 'Thông điệp', dataIndex: 'message' },
          { title: 'Thời gian', dataIndex: 'createdAt', render: (v: string) => new Date(v).toLocaleString('vi-VN') },
        ]}
      />
    </div>
  );
}

export function MonitoringPage() {
  return (
    <div>
      <Typography.Title level={4}>Giám sát hệ thống</Typography.Title>
      <Tabs
        items={[
          { key: 'health', label: 'Tình trạng hệ thống', children: <HealthTab /> },
          { key: 'audit', label: 'Nhật ký audit', children: <AuditTab /> },
          { key: 'integrations', label: 'Tích hợp', children: <IntegrationsTab /> },
        ]}
      />
    </div>
  );
}

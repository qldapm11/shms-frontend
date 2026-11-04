import { Tabs, Table, Typography, Spin, Alert, Tag, Empty } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuth } from '../store/auth';

interface HubDocument {
  id: string;
  path: string;
  title: string;
  category: string | null;
  currentVersion: number;
}
interface HubTask {
  id: string;
  code: string;
  title: string;
  status: string;
  ownerId: string | null;
}
interface HubDecision {
  id: string;
  title: string;
  decision: string;
  authority: string | null;
  decidedAt: string | null;
}

function Documents() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['hub', 'documents'],
    queryFn: async () => (await api.get('/hub/documents')).data.documents as HubDocument[],
  });
  if (isLoading) return <Spin />;
  if (error) return <Alert type="error" message="Không tải được tài liệu" />;
  return (
    <Table
      rowKey="id"
      dataSource={data ?? []}
      pagination={false}
      columns={[
        { title: 'Đường dẫn', dataIndex: 'path' },
        { title: 'Tiêu đề', dataIndex: 'title' },
        { title: 'Phân loại', dataIndex: 'category', render: (c: string | null) => c ?? '—' },
        { title: 'Phiên bản', dataIndex: 'currentVersion' },
      ]}
    />
  );
}

function Tasks() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['hub', 'tasks'],
    queryFn: async () => (await api.get('/hub/tasks')).data.tasks as HubTask[],
  });
  if (isLoading) return <Spin />;
  if (error) return <Alert type="error" message="Không tải được task" />;
  return (
    <Table
      rowKey="id"
      dataSource={data ?? []}
      pagination={false}
      columns={[
        { title: 'Mã', dataIndex: 'code' },
        { title: 'Tiêu đề', dataIndex: 'title' },
        { title: 'Trạng thái', dataIndex: 'status', render: (s: string) => <Tag>{s}</Tag> },
        { title: 'Owner', dataIndex: 'ownerId', render: (o: string | null) => o ?? '—' },
      ]}
    />
  );
}

function Decisions() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['hub', 'decisions'],
    queryFn: async () => (await api.get('/hub/decisions')).data.decisions as HubDecision[],
  });
  if (isLoading) return <Spin />;
  if (error) return <Alert type="error" message="Không tải được quyết định" />;
  return (
    <Table
      rowKey="id"
      dataSource={data ?? []}
      pagination={false}
      columns={[
        { title: 'Tiêu đề', dataIndex: 'title' },
        { title: 'Quyết định', dataIndex: 'decision' },
        { title: 'Thẩm quyền', dataIndex: 'authority', render: (a: string | null) => a ?? '—' },
        {
          title: 'Thời điểm',
          dataIndex: 'decidedAt',
          render: (d: string | null) => (d ? new Date(d).toLocaleString('vi-VN') : '—'),
        },
      ]}
    />
  );
}

export function HubPage() {
  const can = useAuth((s) => s.can);

  if (!can('hub.read')) {
    return <Empty description="Bạn không có quyền truy cập Project Hub" />;
  }

  return (
    <div>
      <Typography.Title level={4}>Project Hub</Typography.Title>
      <Tabs
        items={[
          { key: 'docs', label: 'Tài liệu', children: <Documents /> },
          { key: 'tasks', label: 'Task', children: <Tasks /> },
          { key: 'decisions', label: 'Quyết định', children: <Decisions /> },
        ]}
      />
    </div>
  );
}

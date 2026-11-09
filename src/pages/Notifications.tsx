import {
  List, Button, Tag, Typography, Spin, Alert, Space, Badge, Empty, App,
} from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { api, apiError } from '../api/client';
import { useAuth } from '../store/auth';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  severity: 'INFO' | 'WARN' | 'CRITICAL';
  readAt: string | null;
  createdAt: string;
}

const SEVERITY_META: Record<Notification['severity'], { color: string; label: string }> = {
  INFO: { color: 'blue', label: 'Thông tin' },
  WARN: { color: 'orange', label: 'Cảnh báo' },
  CRITICAL: { color: 'red', label: 'Khẩn cấp' },
};

export function NotificationsPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const { can } = useAuth();

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };
  const scan = useMutation({
    mutationFn: async (path: string) => (await api.post(path)).data,
    onSuccess: (data) => {
      message.success(`Đã quét: tạo ${data.created ?? 0} thông báo mới`);
      refresh();
    },
    onError: (e) => message.error(apiError(e)),
  });

  const list = useQuery({
    queryKey: ['notifications'],
    queryFn: async () =>
      (await api.get('/notifications')).data.items as Notification[],
  });

  const unread = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => (await api.get('/notifications/unread-count')).data.count as number,
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => (await api.post(`/notifications/${id}/read`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (e) => message.error(apiError(e)),
  });

  const forbidden =
    axios.isAxiosError(list.error) && list.error.response?.status === 403;

  if (forbidden) {
    return (
      <Alert
        type="warning"
        showIcon
        message="Không đủ quyền"
        description="Bạn không có quyền xem thông báo."
      />
    );
  }
  if (list.isLoading) return <Spin />;
  if (list.error) return <Alert type="error" message="Không tải được thông báo" />;

  const items = list.data ?? [];

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Space>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Thông báo
          </Typography.Title>
          <Badge count={unread.data ?? 0} showZero color="#faad14" />
        </Space>
        <Space wrap>
          {can('encounter.write') && (
            <Button size="small" loading={scan.isPending} onClick={() => scan.mutate('/notifications/scan-appointments')}>
              Quét nhắc lịch
            </Button>
          )}
          {can('vitals.read') && (
            <Button size="small" loading={scan.isPending} onClick={() => scan.mutate('/notifications/scan-clinical-alerts')}>
              Quét cảnh báo lâm sàng
            </Button>
          )}
          {can('pharmacy.read') && (
            <Button size="small" loading={scan.isPending} onClick={() => scan.mutate('/notifications/scan-operational-alerts')}>
              Quét cảnh báo vận hành
            </Button>
          )}
        </Space>
      </Space>

      {items.length === 0 ? (
        <Empty description="Chưa có thông báo" />
      ) : (
        <List
          dataSource={items}
          renderItem={(n) => {
            const meta = SEVERITY_META[n.severity] ?? SEVERITY_META.INFO;
            const isUnread = !n.readAt;
            return (
              <List.Item
                style={{ background: isUnread ? '#f6ffed00' : undefined, opacity: isUnread ? 1 : 0.65 }}
                actions={[
                  isUnread ? (
                    <Button
                      key="read"
                      size="small"
                      loading={markRead.isPending && markRead.variables === n.id}
                      onClick={() => markRead.mutate(n.id)}
                    >
                      Đánh dấu đã đọc
                    </Button>
                  ) : (
                    <Typography.Text key="read" type="secondary">
                      Đã đọc
                    </Typography.Text>
                  ),
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      {isUnread && <Badge status="processing" />}
                      <Tag color={meta.color}>{meta.label}</Tag>
                      <Typography.Text strong={isUnread}>{n.title}</Typography.Text>
                    </Space>
                  }
                  description={
                    <div>
                      {n.body && <div>{n.body}</div>}
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {new Date(n.createdAt).toLocaleString('vi-VN')}
                      </Typography.Text>
                    </div>
                  }
                />
              </List.Item>
            );
          }}
        />
      )}
    </div>
  );
}

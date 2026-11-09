import { useState } from 'react';
import {
  Tabs, Table, Typography, Spin, Alert, Space, Button, Input, Form, Tag, Card, App,
} from 'antd';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '../api/client';

function is403(err: unknown): boolean {
  return axios.isAxiosError(err) && err.response?.status === 403;
}

function Forbidden({ perm }: { perm: string }) {
  return <Alert type="warning" showIcon message="Không đủ quyền" description={`Bạn không có quyền ${perm}.`} />;
}

interface KvEntry { name: string; value: string; scope: string; }
interface Backup { id: string; type?: string; status?: string; source?: string; note?: string; createdAt?: string; }

// ---------------- Key-value JSON editor (workflows / print-templates) ----------------
function KeyValueTab({ path, label, perm }: { path: string; label: string; perm: string }) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const key = ['admin', path];

  const q = useQuery({
    queryKey: key,
    queryFn: async () => (await api.get(`/admin/${path}`)).data.data as KvEntry[],
  });

  const save = useMutation({
    mutationFn: async (v: { name: string; value: string }) =>
      (await api.put(`/admin/${path}`, { name: v.name, value: v.value })).data,
    onSuccess: () => {
      message.success(`Đã lưu ${label.toLowerCase()}`);
      form.resetFields();
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => { if (!is403(e)) message.error(apiError(e)); },
  });

  if (is403(q.error) || is403(save.error)) return <Forbidden perm={perm} />;
  if (q.isLoading) return <Spin />;
  if (q.error) return <Alert type="error" message={`Không tải được ${label.toLowerCase()}`} />;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Table
        rowKey="name"
        dataSource={q.data ?? []}
        pagination={false}
        columns={[
          { title: 'Tên (key)', dataIndex: 'name', width: 240 },
          {
            title: 'Giá trị (JSON)',
            dataIndex: 'value',
            render: (v: string) => <Typography.Text code style={{ whiteSpace: 'pre-wrap' }}>{v}</Typography.Text>,
          },
          { title: 'Phạm vi', dataIndex: 'scope', width: 120 },
          {
            title: 'Thao tác',
            width: 100,
            render: (_, r: KvEntry) => (
              <Button size="small" onClick={() => form.setFieldsValue({ name: r.name, value: r.value })}>Sửa</Button>
            ),
          },
        ]}
      />
      <Card title={`Thêm / cập nhật ${label.toLowerCase()}`} size="small" style={{ maxWidth: 640 }}>
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
          <Form.Item name="name" label="Tên (key)" rules={[{ required: true, message: 'Nhập tên' }]}>
            <Input placeholder="vi_du_key" />
          </Form.Item>
          <Form.Item
            name="value"
            label="Giá trị (JSON đơn giản)"
            rules={[
              { required: true, message: 'Nhập giá trị' },
              {
                validator: (_r, val) => {
                  if (!val) return Promise.resolve();
                  try { JSON.parse(val); return Promise.resolve(); }
                  catch { return Promise.reject(new Error('JSON không hợp lệ')); }
                },
              },
            ]}
          >
            <Input.TextArea rows={5} placeholder='{"buoc": ["TIEP_NHAN", "KHAM", "KE_DON"]}' />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={save.isPending}>Lưu</Button>
        </Form>
      </Card>
    </Space>
  );
}

// ---------------- Sao lưu / phục hồi (mô phỏng) ----------------
function BackupsTab() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const key = ['admin', 'backups'];

  const q = useQuery({
    queryKey: key,
    queryFn: async () => (await api.get('/admin/backups')).data.data as Backup[],
  });

  const create = useMutation({
    mutationFn: async (vars: { type: 'BACKUP' | 'RESTORE'; note?: string }) =>
      (await api.post('/admin/backups', vars)).data,
    onSuccess: (_d, v) => {
      message.success(v.type === 'RESTORE' ? 'Đã tạo bản phục hồi (mô phỏng)' : 'Đã tạo bản sao lưu (mô phỏng)');
      setNote('');
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => { if (!is403(e)) message.error(apiError(e)); },
  });

  if (is403(q.error) || is403(create.error)) return <Forbidden perm="admin.monitor" />;
  if (q.isLoading) return <Spin />;
  if (q.error) return <Alert type="error" message="Không tải được danh sách sao lưu" />;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Alert type="warning" showIcon message="MÔ PHỎNG" description="Các thao tác sao lưu/phục hồi tại đây chỉ là mô phỏng, không tác động dữ liệu thật." />
      <Space>
        <Input
          placeholder="Ghi chú (tùy chọn)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ width: 280 }}
        />
        <Button type="primary" loading={create.isPending} onClick={() => create.mutate({ type: 'BACKUP', note: note || undefined })}>
          Tạo bản sao lưu
        </Button>
        <Button loading={create.isPending} onClick={() => create.mutate({ type: 'RESTORE', note: note || undefined })}>
          Phục hồi (mô phỏng)
        </Button>
      </Space>
      <Table
        rowKey="id"
        dataSource={q.data ?? []}
        columns={[
          { title: 'Mã', dataIndex: 'id', width: 200 },
          { title: 'Loại', dataIndex: 'type', width: 120, render: (v?: string) => v ?? 'BACKUP' },
          { title: 'Trạng thái', dataIndex: 'status', width: 120, render: (v?: string) => <Tag color="green">{v ?? 'DONE'}</Tag> },
          { title: 'Nguồn', dataIndex: 'source', width: 100, render: (v?: string) => <Tag>{v ?? 'MOCK'}</Tag> },
          { title: 'Ghi chú', dataIndex: 'note' },
          {
            title: 'Thời gian',
            dataIndex: 'createdAt',
            width: 200,
            render: (v?: string) => (v ? new Date(v).toLocaleString('vi-VN') : '—'),
          },
        ]}
      />
    </Space>
  );
}

export function AdvancedConfigPage() {
  return (
    <div>
      <Typography.Title level={4}>Cấu hình nâng cao</Typography.Title>
      <Tabs
        items={[
          { key: 'workflows', label: 'Cấu hình quy trình', children: <KeyValueTab path="workflows" label="Quy trình" perm="admin.config" /> },
          { key: 'print-templates', label: 'Mẫu in', children: <KeyValueTab path="print-templates" label="Mẫu in" perm="admin.config" /> },
          { key: 'backups', label: 'Sao lưu / phục hồi', children: <BackupsTab /> },
        ]}
      />
    </div>
  );
}

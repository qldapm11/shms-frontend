import { useState } from 'react';
import {
  Table, Button, Tag, Typography, Spin, Alert, Space, Modal, Form, Input, Select, App,
} from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '../api/client';

interface AdminUser {
  id: string;
  username: string;
  fullName: string;
  status: 'ACTIVE' | 'LOCKED' | 'DISABLED';
  space: string;
  roles: string[];
}
interface Role {
  id: string;
  code: string;
  name: string;
  space: string;
}

const STATUS_COLOR: Record<string, string> = { ACTIVE: 'green', LOCKED: 'red', DISABLED: 'default' };

export function AdminUsersPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form] = Form.useForm();

  const users = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => (await api.get('/admin/users')).data.data as AdminUser[],
  });

  const roles = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: async () => (await api.get('/admin/roles')).data.data as Role[],
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'users'] });

  const lock = useMutation({
    mutationFn: async (vars: { id: string; lock: boolean }) =>
      (await api.post(`/admin/users/${vars.id}/${vars.lock ? 'lock' : 'unlock'}`)).data,
    onSuccess: (_d, v) => { message.success(v.lock ? 'Đã khóa người dùng' : 'Đã mở khóa'); invalidate(); },
    onError: (e) => message.error(apiError(e)),
  });

  const reset = useMutation({
    mutationFn: async (id: string) => (await api.post(`/admin/users/${id}/reset-password`)).data,
    onSuccess: (data) => {
      Modal.success({
        title: 'Mật khẩu tạm thời',
        content: (
          <Typography.Text copyable strong>{data.data?.tempPassword}</Typography.Text>
        ),
      });
    },
    onError: (e) => message.error(apiError(e)),
  });

  const create = useMutation({
    mutationFn: async (vars: { username: string; password: string; fullName: string; space: string; roles: string[] }) =>
      (await api.post('/admin/users', vars)).data,
    onSuccess: () => {
      message.success('Đã thêm người dùng');
      setAddOpen(false);
      form.resetFields();
      invalidate();
    },
    onError: (e) => message.error(apiError(e)),
  });

  if (users.isLoading) return <Spin />;
  if (users.error) return <Alert type="error" message="Không tải được danh sách người dùng" />;

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Người dùng</Typography.Title>
        <Button type="primary" onClick={() => setAddOpen(true)}>Thêm người dùng</Button>
      </Space>

      <Table
        rowKey="id"
        dataSource={users.data ?? []}
        columns={[
          { title: 'Tài khoản', dataIndex: 'username' },
          { title: 'Họ tên', dataIndex: 'fullName' },
          {
            title: 'Trạng thái',
            dataIndex: 'status',
            render: (s: string) => <Tag color={STATUS_COLOR[s] ?? 'default'}>{s}</Tag>,
          },
          {
            title: 'Vai trò',
            dataIndex: 'roles',
            render: (r: string[]) => (r ?? []).map((c) => <Tag key={c}>{c}</Tag>),
          },
          {
            title: 'Thao tác',
            render: (_, u: AdminUser) => (
              <Space>
                {u.status === 'LOCKED' ? (
                  <Button size="small" onClick={() => lock.mutate({ id: u.id, lock: false })}>Mở khóa</Button>
                ) : (
                  <Button size="small" danger onClick={() => lock.mutate({ id: u.id, lock: true })}>Khóa</Button>
                )}
                <Button size="small" onClick={() => reset.mutate(u.id)}>Đặt lại MK</Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title="Thêm người dùng"
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={create.isPending}
        okText="Tạo"
        cancelText="Hủy"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ space: 'HOSPITAL', roles: [] }}
          onFinish={(v) => create.mutate(v)}
        >
          <Form.Item name="username" label="Tài khoản" rules={[{ required: true, message: 'Nhập tài khoản' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, min: 6, message: 'Tối thiểu 6 ký tự' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="fullName" label="Họ tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="space" label="Không gian">
            <Select
              options={[
                { value: 'HOSPITAL', label: 'HOSPITAL' },
                { value: 'HUB', label: 'HUB' },
                { value: 'BOTH', label: 'BOTH' },
              ]}
            />
          </Form.Item>
          <Form.Item name="roles" label="Vai trò">
            <Select
              mode="multiple"
              loading={roles.isLoading}
              options={(roles.data ?? []).map((r) => ({ value: r.code, label: `${r.name} (${r.code})` }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

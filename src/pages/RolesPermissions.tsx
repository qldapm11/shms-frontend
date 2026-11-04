import { useState } from 'react';
import {
  Tabs, Table, Tag, Typography, Spin, Alert, Space, Button, Input, Form, Select,
  DatePicker, Card, Descriptions, App,
} from 'antd';
import axios from 'axios';
import type { Dayjs } from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '../api/client';

function is403(err: unknown): boolean {
  return axios.isAxiosError(err) && err.response?.status === 403;
}

function Forbidden() {
  return <Alert type="warning" showIcon message="Không đủ quyền" description="Bạn không có quyền quản trị người dùng & vai trò." />;
}

interface Role { id: string; code: string; name: string; space: string; isDefault: boolean; permissions: string[]; }
interface Permission { code: string; name?: string; description?: string; }
interface AdminUser { id: string; username: string; fullName: string; }
interface ImportRow { username: string; fullName: string; password?: string; roleCode: string; departmentCode?: string; }
interface ImportResult { created: string[]; skipped: string[]; errors: { username: string; message: string }[]; }

// ---------------- Vai trò ----------------
function RolesTab() {
  const roles = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: async () => (await api.get('/admin/roles')).data.data as Role[],
  });

  if (is403(roles.error)) return <Forbidden />;
  if (roles.isLoading) return <Spin />;
  if (roles.error) return <Alert type="error" message="Không tải được danh sách vai trò" />;

  return (
    <Table
      rowKey="code"
      dataSource={roles.data ?? []}
      columns={[
        { title: 'Mã', dataIndex: 'code', width: 160 },
        { title: 'Tên', dataIndex: 'name' },
        { title: 'Không gian', dataIndex: 'space', width: 120 },
        { title: 'Mặc định', dataIndex: 'isDefault', width: 100, render: (v: boolean) => (v ? <Tag color="blue">Có</Tag> : '—') },
        {
          title: 'Quyền',
          dataIndex: 'permissions',
          render: (ps: string[]) => (ps ?? []).map((p) => <Tag key={p}>{p}</Tag>),
        },
      ]}
    />
  );
}

// ---------------- Quyền ----------------
function PermissionsTab() {
  const perms = useQuery({
    queryKey: ['admin', 'permissions'],
    queryFn: async () => (await api.get('/admin/permissions')).data.data as Permission[],
  });

  if (is403(perms.error)) return <Forbidden />;
  if (perms.isLoading) return <Spin />;
  if (perms.error) return <Alert type="error" message="Không tải được danh sách quyền" />;

  return (
    <Table
      rowKey="code"
      dataSource={perms.data ?? []}
      columns={[
        { title: 'Mã quyền', dataIndex: 'code', width: 240 },
        { title: 'Tên', dataIndex: 'name' },
        { title: 'Mô tả', dataIndex: 'description' },
      ]}
    />
  );
}

// ---------------- Nhập tài khoản từ Excel ----------------
function parseRows(text: string): ImportRow[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.split(/\t|,|;/).map((c) => c.trim()))
    .filter((cols) => cols[0] && cols[1] && cols[3])
    .map((cols) => ({
      username: cols[0],
      fullName: cols[1],
      password: cols[2] || undefined,
      roleCode: cols[3],
      departmentCode: cols[4] || undefined,
    }));
}

function ImportTab() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const rows = parseRows(text);

  const importMut = useMutation({
    mutationFn: async (payload: ImportRow[]) =>
      (await api.post('/admin/users/import', { rows: payload })).data as ImportResult,
    onSuccess: (res) => {
      message.success(`Nhập xong: ${res.created.length} tạo mới, ${res.skipped.length} bỏ qua, ${res.errors.length} lỗi`);
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (e) => {
      if (is403(e)) return;
      message.error(apiError(e));
    },
  });

  if (is403(importMut.error)) return <Forbidden />;
  const result = importMut.data;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="Dán dữ liệu từ Excel"
        description="Mỗi dòng một tài khoản, các cột ngăn bằng Tab, dấu phẩy hoặc chấm phẩy theo thứ tự: username, fullName, password, roleCode, departmentCode. Cột password và departmentCode có thể bỏ trống."
      />
      <Input.TextArea
        rows={8}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="bsnguyen	Nguyễn Văn A	Matkhau@123	BAC_SI	NOI_TQ"
      />
      <Space>
        <Button
          type="primary"
          loading={importMut.isPending}
          disabled={rows.length === 0}
          onClick={() => importMut.mutate(rows)}
        >
          Nhập {rows.length > 0 ? `(${rows.length} dòng)` : ''}
        </Button>
        <Button onClick={() => setText('')} disabled={!text}>Xóa</Button>
      </Space>

      {rows.length > 0 && (
        <Table
          size="small"
          rowKey={(_r, i) => String(i)}
          dataSource={rows}
          pagination={false}
          title={() => `Xem trước (${rows.length} dòng)`}
          columns={[
            { title: 'Tài khoản', dataIndex: 'username' },
            { title: 'Họ tên', dataIndex: 'fullName' },
            { title: 'Mật khẩu', dataIndex: 'password', render: (v?: string) => (v ? '••••••' : <Tag>mặc định</Tag>) },
            { title: 'Vai trò', dataIndex: 'roleCode' },
            { title: 'Khoa', dataIndex: 'departmentCode' },
          ]}
        />
      )}

      {result && (
        <Card title="Kết quả nhập">
          <Descriptions column={3} bordered size="small">
            <Descriptions.Item label="Tạo mới">{result.created.length}</Descriptions.Item>
            <Descriptions.Item label="Bỏ qua">{result.skipped.length}</Descriptions.Item>
            <Descriptions.Item label="Lỗi">{result.errors.length}</Descriptions.Item>
          </Descriptions>
          {result.created.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <Typography.Text strong>Đã tạo: </Typography.Text>
              {result.created.map((u) => <Tag key={u} color="green">{u}</Tag>)}
            </div>
          )}
          {result.skipped.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <Typography.Text strong>Bỏ qua (đã tồn tại): </Typography.Text>
              {result.skipped.map((u) => <Tag key={u}>{u}</Tag>)}
            </div>
          )}
          {result.errors.length > 0 && (
            <Table
              style={{ marginTop: 12 }}
              size="small"
              rowKey={(_r, i) => String(i)}
              dataSource={result.errors}
              pagination={false}
              columns={[
                { title: 'Tài khoản', dataIndex: 'username', width: 200 },
                { title: 'Lỗi', dataIndex: 'message' },
              ]}
            />
          )}
        </Card>
      )}
    </Space>
  );
}

// ---------------- Phân quyền tạm thời ----------------
function TempGrantTab() {
  const { message } = App.useApp();
  const [form] = Form.useForm();

  const users = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => (await api.get('/admin/users')).data.data as AdminUser[],
  });
  const roles = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: async () => (await api.get('/admin/roles')).data.data as Role[],
  });

  const grant = useMutation({
    mutationFn: async (v: { userId: string; roleCode: string; range: [Dayjs, Dayjs] }) =>
      (await api.post(`/admin/users/${v.userId}/temp-grant`, {
        roleCode: v.roleCode,
        validFrom: v.range[0].toISOString(),
        validTo: v.range[1].toISOString(),
      })).data,
    onSuccess: () => { message.success('Đã cấp quyền tạm thời'); form.resetFields(); },
    onError: (e) => { if (!is403(e)) message.error(apiError(e)); },
  });

  if (is403(users.error) || is403(roles.error) || is403(grant.error)) return <Forbidden />;

  return (
    <Card title="Cấp vai trò có thời hạn" style={{ maxWidth: 560 }}>
      <Form form={form} layout="vertical" onFinish={(v) => grant.mutate(v)}>
        <Form.Item name="userId" label="Người dùng" rules={[{ required: true, message: 'Chọn người dùng' }]}>
          <Select
            loading={users.isLoading}
            showSearch
            optionFilterProp="label"
            options={(users.data ?? []).map((u) => ({ value: u.id, label: `${u.fullName} (${u.username})` }))}
          />
        </Form.Item>
        <Form.Item name="roleCode" label="Vai trò" rules={[{ required: true, message: 'Chọn vai trò' }]}>
          <Select
            loading={roles.isLoading}
            showSearch
            optionFilterProp="label"
            options={(roles.data ?? []).map((r) => ({ value: r.code, label: `${r.name} (${r.code})` }))}
          />
        </Form.Item>
        <Form.Item name="range" label="Hiệu lực (từ - đến)" rules={[{ required: true, message: 'Chọn khoảng thời gian' }]}>
          <DatePicker.RangePicker showTime style={{ width: '100%' }} format="DD/MM/YYYY HH:mm" />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={grant.isPending}>Cấp quyền</Button>
      </Form>
    </Card>
  );
}

export function RolesPermissionsPage() {
  return (
    <div>
      <Typography.Title level={4}>Vai trò & phân quyền</Typography.Title>
      <Tabs
        items={[
          { key: 'roles', label: 'Vai trò', children: <RolesTab /> },
          { key: 'permissions', label: 'Quyền', children: <PermissionsTab /> },
          { key: 'import', label: 'Nhập tài khoản (Excel)', children: <ImportTab /> },
          { key: 'temp-grant', label: 'Phân quyền tạm thời', children: <TempGrantTab /> },
        ]}
      />
    </div>
  );
}

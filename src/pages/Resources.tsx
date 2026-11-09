import { useState } from 'react';
import {
  Tabs, Table, Button, Tag, Typography, Spin, Alert, Space, Modal, Form, Input, Select, DatePicker, App, Popconfirm,
} from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import axios from 'axios';
import { api, apiError } from '../api/client';

interface MedicalDevice {
  id: string;
  code: string;
  name: string;
  departmentId: string | null;
  status: string;
  nextMaintenance: string | null;
}
interface DutyRoster {
  id: string;
  departmentId: string;
  staffId: string;
  shift: string;
  date: string;
}

const DEVICE_STATUS: Record<string, { color: string; label: string }> = {
  ACTIVE: { color: 'green', label: 'Đang dùng' },
  MAINT: { color: 'orange', label: 'Bảo trì' },
  BROKEN: { color: 'red', label: 'Hỏng' },
  RETIRED: { color: 'default', label: 'Ngừng dùng' },
};

function Forbidden() {
  return (
    <Alert
      type="warning"
      showIcon
      message="Không đủ quyền"
      description="Bạn không có quyền xem mục này."
    />
  );
}

function DevicesTab() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MedicalDevice | null>(null);
  const [form] = Form.useForm();

  const devices = useQuery({
    queryKey: ['devices'],
    queryFn: async () => (await api.get('/devices')).data as MedicalDevice[],
    retry: false,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['devices'] });

  const save = useMutation({
    mutationFn: async (vars: any) => {
      const payload = {
        ...vars,
        nextMaintenance: vars.nextMaintenance ? dayjs(vars.nextMaintenance).toISOString() : undefined,
      };
      if (editing) return (await api.patch(`/devices/${editing.id}`, payload)).data;
      return (await api.post('/devices', payload)).data;
    },
    onSuccess: () => {
      message.success(editing ? 'Đã cập nhật thiết bị' : 'Đã thêm thiết bị');
      setOpen(false);
      setEditing(null);
      form.resetFields();
      invalidate();
    },
    onError: (e) => message.error(apiError(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/devices/${id}`)).data,
    onSuccess: () => { message.success('Đã xóa thiết bị'); invalidate(); },
    onError: (e) => message.error(apiError(e)),
  });

  if (axios.isAxiosError(devices.error) && devices.error.response?.status === 403) {
    return <Forbidden />;
  }
  if (devices.isLoading) return <Spin />;
  if (devices.error) return <Alert type="error" message="Không tải được danh sách thiết bị" />;

  function openAdd() {
    setEditing(null);
    form.resetFields();
    setOpen(true);
  }
  function openEdit(d: MedicalDevice) {
    setEditing(d);
    form.setFieldsValue({
      code: d.code,
      name: d.name,
      departmentId: d.departmentId ?? undefined,
      status: d.status,
      nextMaintenance: d.nextMaintenance ? dayjs(d.nextMaintenance) : undefined,
    });
    setOpen(true);
  }

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'flex-end' }}>
        <Button type="primary" onClick={openAdd}>
          Thêm thiết bị
        </Button>
      </Space>
      <Table<MedicalDevice>
        rowKey="id"
        dataSource={devices.data ?? []}
        columns={[
          { title: 'Mã', dataIndex: 'code' },
          { title: 'Tên thiết bị', dataIndex: 'name' },
          {
            title: 'Trạng thái',
            dataIndex: 'status',
            render: (s: string) => {
              const m = DEVICE_STATUS[s] ?? { color: 'default', label: s };
              return <Tag color={m.color}>{m.label}</Tag>;
            },
          },
          {
            title: 'Bảo trì kế tiếp',
            dataIndex: 'nextMaintenance',
            render: (t: string | null) => (t ? new Date(t).toLocaleDateString('vi-VN') : '—'),
          },
          {
            title: 'Thao tác',
            render: (_: unknown, d: MedicalDevice) => (
              <Space>
                <Button size="small" onClick={() => openEdit(d)}>Sửa</Button>
                <Popconfirm title="Xóa thiết bị?" okText="Xóa" cancelText="Hủy" okButtonProps={{ danger: true }} onConfirm={() => remove.mutate(d.id)}>
                  <Button size="small" danger>Xóa</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editing ? 'Sửa thiết bị' : 'Thêm thiết bị'}
        open={open}
        onCancel={() => {
          setOpen(false);
          setEditing(null);
        }}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ status: 'ACTIVE' }}
          onFinish={(v) => save.mutate(v)}
        >
          <Form.Item
            name="code"
            label="Mã thiết bị"
            rules={[{ required: true, message: 'Nhập mã thiết bị' }]}
          >
            <Input disabled={!!editing} />
          </Form.Item>
          <Form.Item
            name="name"
            label="Tên thiết bị"
            rules={[{ required: true, message: 'Nhập tên thiết bị' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="departmentId" label="Khoa (ID)">
            <Input placeholder="Tùy chọn" />
          </Form.Item>
          <Form.Item name="status" label="Trạng thái">
            <Select
              options={Object.entries(DEVICE_STATUS).map(([value, m]) => ({
                value,
                label: m.label,
              }))}
            />
          </Form.Item>
          <Form.Item name="nextMaintenance" label="Lịch bảo trì kế tiếp">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function RostersTab() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const rosters = useQuery({
    queryKey: ['rosters'],
    queryFn: async () => (await api.get('/rosters')).data as DutyRoster[],
    retry: false,
  });

  const create = useMutation({
    mutationFn: async (vars: any) =>
      (
        await api.post('/rosters', {
          ...vars,
          date: dayjs(vars.date).toISOString(),
        })
      ).data,
    onSuccess: () => {
      message.success('Đã thêm lịch trực');
      setOpen(false);
      form.resetFields();
      qc.invalidateQueries({ queryKey: ['rosters'] });
    },
    onError: (e) => message.error(apiError(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/rosters/${id}`)).data,
    onSuccess: () => { message.success('Đã xóa lịch trực'); qc.invalidateQueries({ queryKey: ['rosters'] }); },
    onError: (e) => message.error(apiError(e)),
  });

  if (axios.isAxiosError(rosters.error) && rosters.error.response?.status === 403) {
    return <Forbidden />;
  }
  if (rosters.isLoading) return <Spin />;
  if (rosters.error) return <Alert type="error" message="Không tải được lịch trực" />;

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'flex-end' }}>
        <Button type="primary" onClick={() => setOpen(true)}>
          Thêm lịch trực
        </Button>
      </Space>
      <Table<DutyRoster>
        rowKey="id"
        dataSource={rosters.data ?? []}
        columns={[
          {
            title: 'Ngày',
            dataIndex: 'date',
            render: (t: string) => new Date(t).toLocaleDateString('vi-VN'),
          },
          { title: 'Ca trực', dataIndex: 'shift', render: (s: string) => <Tag>{s}</Tag> },
          { title: 'Khoa (ID)', dataIndex: 'departmentId' },
          { title: 'Nhân viên (ID)', dataIndex: 'staffId' },
          {
            title: 'Thao tác',
            render: (_: unknown, r: DutyRoster) => (
              <Popconfirm title="Xóa lịch trực?" okText="Xóa" cancelText="Hủy" okButtonProps={{ danger: true }} onConfirm={() => remove.mutate(r.id)}>
                <Button size="small" danger>Xóa</Button>
              </Popconfirm>
            ),
          },
        ]}
      />

      <Modal
        title="Thêm lịch trực"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={create.isPending}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" onFinish={(v) => create.mutate(v)}>
          <Form.Item
            name="departmentId"
            label="Khoa (ID)"
            rules={[{ required: true, message: 'Nhập mã khoa' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="staffId"
            label="Nhân viên (ID)"
            rules={[{ required: true, message: 'Nhập mã nhân viên' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="shift"
            label="Ca trực"
            rules={[{ required: true, message: 'Chọn ca trực' }]}
          >
            <Select
              options={[
                { value: 'SANG', label: 'Sáng' },
                { value: 'CHIEU', label: 'Chiều' },
                { value: 'DEM', label: 'Đêm' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="date"
            label="Ngày"
            rules={[{ required: true, message: 'Chọn ngày' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export function ResourcesPage() {
  return (
    <div>
      <Typography.Title level={4}>Nguồn lực</Typography.Title>
      <Tabs
        items={[
          { key: 'devices', label: 'Thiết bị y tế', children: <DevicesTab /> },
          { key: 'rosters', label: 'Lịch trực', children: <RostersTab /> },
        ]}
      />
    </div>
  );
}

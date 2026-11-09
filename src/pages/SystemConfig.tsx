import { useState } from 'react';
import {
  Tabs, Table, Button, Tag, Typography, Spin, Alert, Space, Modal, Form, Input, Select,
  InputNumber, App,
} from 'antd';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '../api/client';

function is403(err: unknown): boolean {
  return axios.isAxiosError(err) && err.response?.status === 403;
}

function Forbidden() {
  return <Alert type="warning" showIcon message="Không đủ quyền" description="Bạn không có quyền cấu hình hệ thống." />;
}

interface ConfigParam { key: string; value: string; scope: string; }
interface Threshold {
  id: string; metric: string; deptId: string | null; minVal: number | null; maxVal: number | null;
  severity: 'INFO' | 'WARN' | 'CRITICAL';
}

const SEVERITY_COLOR: Record<string, string> = { INFO: 'blue', WARN: 'gold', CRITICAL: 'red' };

// ---------------- Config params ----------------
function ConfigTab() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ConfigParam | null>(null);
  const [form] = Form.useForm();

  const q = useQuery({
    queryKey: ['config', 'params'],
    queryFn: async () => (await api.get('/admin/config')).data.data as ConfigParam[],
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['config', 'params'] });

  const save = useMutation({
    mutationFn: async (v: { key: string; value: string; scope: string }) =>
      (await api.put('/admin/config', v)).data,
    onSuccess: () => { message.success('Đã lưu tham số'); setOpen(false); form.resetFields(); invalidate(); },
    onError: (e) => message.error(apiError(e)),
  });

  if (is403(q.error)) return <Forbidden />;
  if (q.isLoading) return <Spin />;
  if (q.error) return <Alert type="error" message="Không tải được tham số hệ thống" />;

  const openAdd = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ scope: 'GLOBAL' }); setOpen(true); };
  const openEdit = (c: ConfigParam) => { setEditing(c); form.setFieldsValue(c); setOpen(true); };

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'flex-end' }}>
        <Button type="primary" onClick={openAdd}>Thêm tham số</Button>
      </Space>
      <Table
        rowKey="key"
        dataSource={q.data ?? []}
        columns={[
          { title: 'Khóa', dataIndex: 'key' },
          { title: 'Giá trị', dataIndex: 'value' },
          { title: 'Phạm vi', dataIndex: 'scope' },
          {
            title: 'Thao tác',
            render: (_, c: ConfigParam) => <Button size="small" onClick={() => openEdit(c)}>Sửa</Button>,
          },
        ]}
      />
      <Modal
        title={editing ? 'Sửa tham số' : 'Thêm tham số'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
          <Form.Item name="key" label="Khóa" rules={[{ required: true, message: 'Nhập khóa' }]}>
            <Input disabled={!!editing} />
          </Form.Item>
          <Form.Item name="value" label="Giá trị" rules={[{ required: true, message: 'Nhập giá trị' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="scope" label="Phạm vi">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ---------------- Thresholds ----------------
function ThresholdsTab() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const q = useQuery({
    queryKey: ['config', 'thresholds'],
    queryFn: async () => (await api.get('/admin/thresholds')).data.data as Threshold[],
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['config', 'thresholds'] });

  const create = useMutation({
    mutationFn: async (v: Record<string, unknown>) => (await api.post('/admin/thresholds', v)).data,
    onSuccess: () => { message.success('Đã thêm ngưỡng cảnh báo'); setOpen(false); form.resetFields(); invalidate(); },
    onError: (e) => message.error(apiError(e)),
  });

  if (is403(q.error)) return <Forbidden />;
  if (q.isLoading) return <Spin />;
  if (q.error) return <Alert type="error" message="Không tải được ngưỡng cảnh báo" />;

  const openAdd = () => { form.resetFields(); form.setFieldsValue({ severity: 'WARN' }); setOpen(true); };

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'flex-end' }}>
        <Button type="primary" onClick={openAdd}>Thêm ngưỡng</Button>
      </Space>
      <Table
        rowKey="id"
        dataSource={q.data ?? []}
        columns={[
          { title: 'Chỉ số', dataIndex: 'metric' },
          { title: 'Min', dataIndex: 'minVal', align: 'right' },
          { title: 'Max', dataIndex: 'maxVal', align: 'right' },
          {
            title: 'Mức độ',
            dataIndex: 'severity',
            render: (s: string) => <Tag color={SEVERITY_COLOR[s] ?? 'default'}>{s}</Tag>,
          },
        ]}
      />
      <Modal
        title="Thêm ngưỡng cảnh báo"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={create.isPending}
        okText="Thêm"
        cancelText="Hủy"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) => create.mutate({
            metric: v.metric,
            minVal: v.minVal ?? null,
            maxVal: v.maxVal ?? null,
            severity: v.severity,
          })}
        >
          <Form.Item name="metric" label="Chỉ số" rules={[{ required: true, message: 'Nhập chỉ số' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="minVal" label="Giá trị tối thiểu">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="maxVal" label="Giá trị tối đa">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="severity" label="Mức độ" rules={[{ required: true }]}>
            <Select options={[
              { value: 'INFO', label: 'Thông tin' },
              { value: 'WARN', label: 'Cảnh báo' },
              { value: 'CRITICAL', label: 'Nghiêm trọng' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export function SystemConfigPage() {
  return (
    <div>
      <Typography.Title level={4}>Cấu hình hệ thống</Typography.Title>
      <Tabs
        items={[
          { key: 'params', label: 'Tham số', children: <ConfigTab /> },
          { key: 'thresholds', label: 'Ngưỡng cảnh báo', children: <ThresholdsTab /> },
        ]}
      />
    </div>
  );
}

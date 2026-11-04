import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  Spin,
  App,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '../api/client';

interface Patient {
  fullName?: string;
  code?: string;
}
interface Admission {
  id: string;
  status: string;
  bed?: { code?: string } | null;
  encounter?: { patient?: Patient | null } | null;
}
interface CareTask {
  id: string;
  type: string;
  scheduledAt: string | null;
  note: string | null;
  doneAt: string | null;
}
interface VitalSign {
  id: string;
  hr: number | null;
  spo2: number | null;
  temp: number | null;
  bpSys: number | null;
  bpDia: number | null;
  measuredAt: string;
  source: string;
}

export function InpatientCarePage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [admissionId, setAdmissionId] = useState<string | undefined>();
  const [taskForm] = Form.useForm();
  const [vitalForm] = Form.useForm();

  const { data: admissions, isLoading: loadingAdm } = useQuery({
    queryKey: ['admissions', 'ADMITTED'],
    queryFn: async () =>
      (await api.get<Admission[]>('/admissions', { params: { status: 'ADMITTED' } })).data,
  });

  const { data: tasks, isLoading: loadingTasks, error: tasksErr } = useQuery({
    queryKey: ['care-tasks', admissionId],
    enabled: !!admissionId,
    queryFn: async () => (await api.get<CareTask[]>(`/admissions/${admissionId}/care-tasks`)).data,
  });

  const { data: vitals, isLoading: loadingVitals, error: vitalsErr } = useQuery({
    queryKey: ['vitals', admissionId],
    enabled: !!admissionId,
    queryFn: async () => (await api.get<VitalSign[]>(`/admissions/${admissionId}/vitals`)).data,
  });

  const addTask = useMutation({
    mutationFn: async (v: { type: string; note?: string }) =>
      (await api.post(`/admissions/${admissionId}/care-tasks`, v)).data,
    onSuccess: () => {
      message.success('Đã thêm y lệnh chăm sóc');
      taskForm.resetFields();
      qc.invalidateQueries({ queryKey: ['care-tasks', admissionId] });
    },
    onError: (e) => message.error(apiError(e)),
  });

  const doneTask = useMutation({
    mutationFn: async (id: string) => (await api.post(`/care-tasks/${id}/done`, {})).data,
    onSuccess: () => {
      message.success('Đã hoàn thành');
      qc.invalidateQueries({ queryKey: ['care-tasks', admissionId] });
    },
    onError: (e) => message.error(apiError(e)),
  });

  const addVital = useMutation({
    mutationFn: async (v: Record<string, number | undefined>) =>
      (await api.post(`/admissions/${admissionId}/vitals`, v)).data,
    onSuccess: () => {
      message.success('Đã ghi sinh hiệu');
      vitalForm.resetFields();
      qc.invalidateQueries({ queryKey: ['vitals', admissionId] });
    },
    onError: (e) => message.error(apiError(e)),
  });

  const taskColumns = [
    { title: 'Loại y lệnh', dataIndex: 'type', key: 'type' },
    {
      title: 'Lịch',
      key: 'scheduledAt',
      render: (_: unknown, r: CareTask) =>
        r.scheduledAt ? new Date(r.scheduledAt).toLocaleString('vi-VN') : '—',
    },
    { title: 'Ghi chú', dataIndex: 'note', key: 'note', render: (v: string | null) => v || '—' },
    {
      title: 'Trạng thái',
      key: 'doneAt',
      render: (_: unknown, r: CareTask) =>
        r.doneAt ? (
          <Tag color="green">Hoàn thành {new Date(r.doneAt).toLocaleString('vi-VN')}</Tag>
        ) : (
          <Tag color="orange">Chờ thực hiện</Tag>
        ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_: unknown, r: CareTask) =>
        r.doneAt ? (
          <Typography.Text type="secondary">—</Typography.Text>
        ) : (
          <Button
            size="small"
            type="primary"
            loading={doneTask.isPending && doneTask.variables === r.id}
            onClick={() => doneTask.mutate(r.id)}
          >
            Đánh dấu xong
          </Button>
        ),
    },
  ];

  const vitalColumns = [
    {
      title: 'Thời điểm',
      key: 'measuredAt',
      render: (_: unknown, r: VitalSign) => new Date(r.measuredAt).toLocaleString('vi-VN'),
    },
    { title: 'Mạch (hr)', dataIndex: 'hr', key: 'hr', render: (v: number | null) => v ?? '—' },
    { title: 'SpO2 (%)', dataIndex: 'spo2', key: 'spo2', render: (v: number | null) => v ?? '—' },
    { title: 'Nhiệt độ (°C)', dataIndex: 'temp', key: 'temp', render: (v: number | null) => v ?? '—' },
    {
      title: 'Huyết áp',
      key: 'bp',
      render: (_: unknown, r: VitalSign) =>
        r.bpSys != null || r.bpDia != null ? `${r.bpSys ?? '—'}/${r.bpDia ?? '—'}` : '—',
    },
    { title: 'Nguồn', dataIndex: 'source', key: 'source', render: (v: string) => <Tag>{v}</Tag> },
  ];

  const careTab = (
    <Card>
      {tasksErr && <Alert style={{ marginBottom: 12 }} type="error" message="Không tải được y lệnh chăm sóc" />}
      <Form form={taskForm} layout="inline" style={{ marginBottom: 16 }} onFinish={(v) => addTask.mutate(v)}>
        <Form.Item name="type" rules={[{ required: true, message: 'Nhập loại y lệnh' }]}>
          <Input placeholder="Loại y lệnh (VD: Thay băng)" style={{ width: 220 }} />
        </Form.Item>
        <Form.Item name="note">
          <Input placeholder="Ghi chú" style={{ width: 240 }} />
        </Form.Item>
        <Form.Item>
          <Button icon={<PlusOutlined />} htmlType="submit" loading={addTask.isPending}>
            Thêm y lệnh
          </Button>
        </Form.Item>
      </Form>
      <Table
        rowKey="id"
        loading={loadingTasks}
        columns={taskColumns}
        dataSource={tasks ?? []}
        pagination={false}
        size="small"
      />
    </Card>
  );

  const vitalTab = (
    <Card>
      {vitalsErr && <Alert style={{ marginBottom: 12 }} type="error" message="Không tải được sinh hiệu" />}
      <Form form={vitalForm} layout="inline" style={{ marginBottom: 16 }} onFinish={(v) => addVital.mutate(v)}>
        <Form.Item name="hr" label="Mạch">
          <InputNumber min={0} style={{ width: 90 }} placeholder="hr" />
        </Form.Item>
        <Form.Item name="spo2" label="SpO2">
          <InputNumber min={0} max={100} style={{ width: 90 }} placeholder="%" />
        </Form.Item>
        <Form.Item name="temp" label="Nhiệt độ">
          <InputNumber min={0} step={0.1} style={{ width: 90 }} placeholder="°C" />
        </Form.Item>
        <Form.Item name="bpSys" label="HA tâm thu">
          <InputNumber min={0} style={{ width: 90 }} placeholder="sys" />
        </Form.Item>
        <Form.Item name="bpDia" label="HA tâm trương">
          <InputNumber min={0} style={{ width: 90 }} placeholder="dia" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" icon={<PlusOutlined />} htmlType="submit" loading={addVital.isPending}>
            Ghi sinh hiệu
          </Button>
        </Form.Item>
      </Form>
      <Table
        rowKey="id"
        loading={loadingVitals}
        columns={vitalColumns}
        dataSource={vitals ?? []}
        pagination={false}
        size="small"
      />
    </Card>
  );

  return (
    <div>
      <Typography.Title level={4}>Chăm sóc nội trú</Typography.Title>
      {loadingAdm ? (
        <Spin />
      ) : (
        <Space style={{ marginBottom: 16 }}>
          <Typography.Text>Hồ sơ nhập viện:</Typography.Text>
          <Select
            showSearch
            style={{ width: 360 }}
            placeholder="Chọn hồ sơ đang điều trị"
            optionFilterProp="label"
            value={admissionId}
            onChange={setAdmissionId}
            options={(admissions ?? []).map((a) => ({
              value: a.id,
              label: `${a.encounter?.patient?.fullName ?? 'Không rõ'}${
                a.bed?.code ? ` — giường ${a.bed.code}` : ''
              }`,
            }))}
            notFoundContent="Không có hồ sơ đang điều trị"
          />
        </Space>
      )}

      {admissionId ? (
        <Tabs
          items={[
            { key: 'care', label: 'Y lệnh & chăm sóc', children: careTab },
            { key: 'vitals', label: 'Sinh hiệu', children: vitalTab },
          ]}
        />
      ) : (
        <Alert type="info" message="Chọn một hồ sơ nhập viện để xem y lệnh và sinh hiệu" />
      )}
    </div>
  );
}

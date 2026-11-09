import { useState } from 'react';
import {
  Alert,
  Button,
  Form,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Spin,
  App,
} from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '../api/client';

interface Patient {
  id: string;
  code?: string;
  fullName?: string;
}
interface Bed {
  id: string;
  code: string;
  status: string;
  department?: { name?: string } | null;
}
interface Encounter {
  id: string;
  status: string;
  queueNo?: number;
  patient?: Patient | null;
}
interface Admission {
  id: string;
  status: string;
  admitAt: string;
  bedId: string | null;
  bed?: Bed | null;
  encounter?: (Encounter & { patient?: Patient | null }) | null;
}

const STATUS_META: Record<string, { text: string; color: string }> = {
  ADMITTED: { text: 'Đang điều trị', color: 'blue' },
  DISCHARGED: { text: 'Đã xuất viện', color: 'default' },
};

// Trạng thái lượt khám đã kết thúc hoặc đã nhập viện → không thể nhập viện tiếp.
const NON_ADMITTABLE = new Set(['ADMITTED', 'DISCHARGED', 'DONE']);

export function AdmissionsPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [admitOpen, setAdmitOpen] = useState(false);
  const [transferFor, setTransferFor] = useState<Admission | null>(null);
  const [admitForm] = Form.useForm();
  const [transferForm] = Form.useForm();

  const { data: admissions, isLoading, error } = useQuery({
    queryKey: ['admissions', statusFilter],
    queryFn: async () =>
      (await api.get<Admission[]>('/admissions', { params: statusFilter ? { status: statusFilter } : {} }))
        .data,
  });

  // Giường trống phục vụ nhập viện / chuyển giường.
  const { data: emptyBeds } = useQuery({
    queryKey: ['beds'],
    queryFn: async () => (await api.get<Bed[]>('/beds')).data,
    select: (beds) => beds.filter((b) => b.status === 'EMPTY'),
  });

  // Lượt khám có thể nhập viện.
  const { data: encounters } = useQuery({
    queryKey: ['encounters'],
    queryFn: async () => (await api.get('/encounters')).data.data as Encounter[],
    select: (list) => list.filter((e) => !NON_ADMITTABLE.has(e.status)),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admissions'] });
    qc.invalidateQueries({ queryKey: ['beds'] });
    qc.invalidateQueries({ queryKey: ['encounters'] });
  };

  const admit = useMutation({
    mutationFn: async (v: { encounterId: string; bedId: string }) =>
      (await api.post(`/encounters/${v.encounterId}/admit`, { bedId: v.bedId })).data,
    onSuccess: () => {
      message.success('Đã nhập viện');
      setAdmitOpen(false);
      admitForm.resetFields();
      invalidate();
    },
    onError: (e) => message.error(apiError(e)),
  });

  const transfer = useMutation({
    mutationFn: async (v: { id: string; bedId: string }) =>
      (await api.post(`/admissions/${v.id}/transfer`, { bedId: v.bedId })).data,
    onSuccess: () => {
      message.success('Đã chuyển giường');
      setTransferFor(null);
      transferForm.resetFields();
      invalidate();
    },
    onError: (e) => message.error(apiError(e)),
  });

  const discharge = useMutation({
    mutationFn: async (id: string) => (await api.post(`/admissions/${id}/discharge`, {})).data,
    onSuccess: () => {
      message.success('Đã xuất viện');
      invalidate();
    },
    onError: (e) => message.error(apiError(e)),
  });

  const columns = [
    {
      title: 'Bệnh nhân',
      key: 'patient',
      render: (_: unknown, r: Admission) => {
        const p = r.encounter?.patient;
        return p ? `${p.fullName ?? ''}${p.code ? ` (${p.code})` : ''}` : '—';
      },
    },
    {
      title: 'Giường',
      key: 'bed',
      render: (_: unknown, r: Admission) => r.bed?.code ?? '—',
    },
    {
      title: 'Trạng thái',
      key: 'status',
      render: (_: unknown, r: Admission) => {
        const meta = STATUS_META[r.status] ?? { text: r.status, color: 'default' };
        return <Tag color={meta.color}>{meta.text}</Tag>;
      },
    },
    {
      title: 'Ngày nhập',
      key: 'admitAt',
      render: (_: unknown, r: Admission) => (r.admitAt ? new Date(r.admitAt).toLocaleString('vi-VN') : '—'),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_: unknown, r: Admission) =>
        r.status === 'ADMITTED' ? (
          <Space>
            <Button
              size="small"
              onClick={() => {
                setTransferFor(r);
                transferForm.resetFields();
              }}
            >
              Chuyển giường
            </Button>
            <Button
              size="small"
              danger
              loading={discharge.isPending && discharge.variables === r.id}
              onClick={() => discharge.mutate(r.id)}
            >
              Xuất viện
            </Button>
          </Space>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
  ];

  if (isLoading) return <Spin />;
  if (error) return <Alert type="error" message="Không tải được danh sách nội trú" />;

  const bedOptions = (emptyBeds ?? []).map((b) => ({
    value: b.id,
    label: `${b.code}${b.department?.name ? ` — ${b.department.name}` : ''}`,
  }));

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Nội trú
        </Typography.Title>
        <Space>
          <Select
            allowClear
            placeholder="Lọc trạng thái"
            style={{ width: 180 }}
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'ADMITTED', label: 'Đang điều trị' },
              { value: 'DISCHARGED', label: 'Đã xuất viện' },
            ]}
          />
          <Button
            type="primary"
            onClick={() => {
              setAdmitOpen(true);
              admitForm.resetFields();
            }}
          >
            Nhập viện
          </Button>
        </Space>
      </Space>

      <Table rowKey="id" columns={columns} dataSource={admissions ?? []} pagination={{ pageSize: 20 }} />

      <Modal
        title="Nhập viện"
        open={admitOpen}
        onCancel={() => setAdmitOpen(false)}
        onOk={() => admitForm.submit()}
        confirmLoading={admit.isPending}
        okText="Nhập viện"
        cancelText="Hủy"
      >
        <Form form={admitForm} layout="vertical" onFinish={(v) => admit.mutate(v)}>
          <Form.Item
            name="encounterId"
            label="Lượt khám"
            rules={[{ required: true, message: 'Chọn lượt khám' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Chọn lượt khám cần nhập viện"
              options={(encounters ?? []).map((e) => ({
                value: e.id,
                label: `${e.patient?.fullName ?? 'Không rõ'}${e.patient?.code ? ` (${e.patient.code})` : ''} — ${e.status}`,
              }))}
              notFoundContent="Không có lượt khám phù hợp"
            />
          </Form.Item>
          <Form.Item name="bedId" label="Giường trống" rules={[{ required: true, message: 'Chọn giường' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Chọn giường EMPTY"
              options={bedOptions}
              notFoundContent="Không có giường trống"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Chuyển giường${transferFor?.bed?.code ? ` — đang ở ${transferFor.bed.code}` : ''}`}
        open={!!transferFor}
        onCancel={() => setTransferFor(null)}
        onOk={() => transferForm.submit()}
        confirmLoading={transfer.isPending}
        okText="Chuyển"
        cancelText="Hủy"
      >
        <Form
          form={transferForm}
          layout="vertical"
          onFinish={(v) => transferFor && transfer.mutate({ id: transferFor.id, bedId: v.bedId })}
        >
          <Form.Item name="bedId" label="Giường mới" rules={[{ required: true, message: 'Chọn giường' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Chọn giường trống"
              options={bedOptions}
              notFoundContent="Không có giường trống"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

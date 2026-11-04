import { useState } from 'react';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  Row,
  Select,
  Space,
  Tag,
  Typography,
  Alert,
  App,
} from 'antd';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api, apiError } from '../api/client';

interface Patient {
  id: string;
  code: string;
  fullName: string;
  phone?: string | null;
}

interface Department {
  id: string;
  code: string;
  name: string;
}

interface BhytResult {
  valid: boolean;
  source: string;
  note: string;
  cardNo: string | null;
}

export function ReceptionPage() {
  const { message } = App.useApp();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState<string | undefined>();
  const [queueNo, setQueueNo] = useState<number | null>(null);
  const [bhyt, setBhyt] = useState<BhytResult | null>(null);
  const [createForm] = Form.useForm();

  const { data: patients, refetch: refetchPatients } = useQuery({
    queryKey: ['reception-patients', search],
    queryFn: async () =>
      (await api.get('/patients', { params: search ? { q: search } : {} })).data.data as Patient[],
    enabled: false,
  });

  const { data: departments } = useQuery({
    queryKey: ['reception-departments'],
    queryFn: async () => (await api.get('/admin/departments')).data.data as Department[],
  });

  const createPatient = useMutation({
    mutationFn: async (values: { fullName: string; phone?: string; cccd?: string }) =>
      (await api.post('/patients', values)).data.data as Patient,
    onSuccess: (p) => {
      message.success(`Đã tạo người bệnh ${p.code}`);
      setPatient(p);
      createForm.resetFields();
    },
    onError: (e) => message.error(apiError(e)),
  });

  const createEncounter = useMutation({
    mutationFn: async () => {
      if (!patient) throw new Error('Chưa chọn người bệnh');
      const body = { patientId: patient.id, departmentId, type: 'OUTPATIENT' as const };
      return (await api.post('/encounters', body)).data.data as { id: string; queueNo: number };
    },
    onSuccess: (enc) => {
      setQueueNo(enc.queueNo);
      message.success('Đã tạo lượt khám');
    },
    onError: (e) => message.error(apiError(e)),
  });

  const checkBhyt = useMutation({
    mutationFn: async () => {
      if (!patient) throw new Error('Chưa chọn người bệnh');
      return (await api.get(`/patients/${patient.id}/bhyt-check`)).data as BhytResult;
    },
    onSuccess: (r) => setBhyt(r),
    onError: (e) => message.error(apiError(e)),
  });

  function selectPatient(p: Patient) {
    setPatient(p);
    setQueueNo(null);
    setBhyt(null);
  }

  return (
    <div>
      <Typography.Title level={4}>Tiếp nhận</Typography.Title>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Card title="1. Tìm người bệnh" style={{ marginBottom: 16 }}>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                placeholder="Tên, mã, điện thoại, CCCD"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onPressEnter={() => refetchPatients()}
              />
              <Button type="primary" onClick={() => refetchPatients()}>
                Tìm
              </Button>
            </Space.Compact>
            <div style={{ marginTop: 12 }}>
              {(patients ?? []).map((p) => (
                <div
                  key={p.id}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    marginBottom: 6,
                    cursor: 'pointer',
                    background: patient?.id === p.id ? '#e3f2fd' : '#fafafa',
                  }}
                  onClick={() => selectPatient(p)}
                >
                  <b>{p.code}</b> · {p.fullName} {p.phone ? `· ${p.phone}` : ''}
                </div>
              ))}
            </div>
          </Card>

          <Card title="Hoặc tạo người bệnh mới">
            <Form form={createForm} layout="vertical" onFinish={(v) => createPatient.mutate(v)}>
              <Form.Item name="fullName" label="Họ tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
                <Input placeholder="Nguyễn Văn A" />
              </Form.Item>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="phone" label="Điện thoại">
                    <Input placeholder="09xxxxxxxx" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="cccd" label="CCCD">
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
              <Button type="dashed" htmlType="submit" block loading={createPatient.isPending}>
                Tạo người bệnh
              </Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="2. Tạo lượt khám">
            {patient ? (
              <>
                <Alert
                  style={{ marginBottom: 16 }}
                  type="info"
                  message={`Người bệnh: ${patient.code} — ${patient.fullName}`}
                />
                <Form layout="vertical">
                  <Form.Item label="Khoa khám">
                    <Select
                      allowClear
                      placeholder="Chọn khoa"
                      value={departmentId}
                      onChange={setDepartmentId}
                      options={(departments ?? []).map((d) => ({
                        value: d.id,
                        label: `${d.code} — ${d.name}`,
                      }))}
                    />
                  </Form.Item>
                  <Space>
                    <Button
                      type="primary"
                      loading={createEncounter.isPending}
                      onClick={() => createEncounter.mutate()}
                    >
                      Tiếp nhận khám
                    </Button>
                    <Button loading={checkBhyt.isPending} onClick={() => checkBhyt.mutate()}>
                      Kiểm tra BHYT
                    </Button>
                  </Space>
                </Form>

                {queueNo != null && (
                  <div style={{ textAlign: 'center', marginTop: 24 }}>
                    <Typography.Text type="secondary">Số thứ tự</Typography.Text>
                    <div style={{ fontSize: 56, fontWeight: 700, color: '#1565c0', lineHeight: 1 }}>
                      {queueNo}
                    </div>
                  </div>
                )}

                {bhyt && (
                  <Alert
                    style={{ marginTop: 16 }}
                    type={bhyt.valid ? 'success' : 'warning'}
                    message={
                      <Space>
                        {bhyt.valid ? 'Thẻ BHYT hợp lệ' : 'Thẻ BHYT không hợp lệ'}
                        <Tag color="orange">mô phỏng</Tag>
                      </Space>
                    }
                    description={`Số thẻ: ${bhyt.cardNo ?? '—'} · ${bhyt.note}`}
                  />
                )}
              </>
            ) : (
              <Typography.Text type="secondary">Chọn hoặc tạo người bệnh trước.</Typography.Text>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}

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
import { useParams } from 'react-router-dom';
import { api, apiError } from '../api/client';

interface Icd10 {
  code: string;
  name: string;
}
interface Drug {
  id: string;
  code: string;
  name: string;
  unit: string;
}
interface PrescriptionItem {
  id: string;
  dose: string;
  frequency: string;
  durationDays: number;
  quantity: number;
  drug?: Drug;
}
interface Prescription {
  id: string;
  status: string;
  items?: PrescriptionItem[];
}
interface Warning {
  pair: string[];
  severity: string;
  note: string;
}
interface Service {
  id: string;
  code: string;
  name: string;
  specialty?: string | null;
}
interface Order {
  id: string;
  type: string;
  serviceId?: string | null;
  status: string;
  resultJson?: string | null;
}

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  DRAFT: { text: 'Nháp', color: 'default' },
  SIGNED: { text: 'Đã ký', color: 'green' },
};

export function EncounterExamPage() {
  const { id = '' } = useParams();
  const { message } = App.useApp();
  const qc = useQueryClient();

  // ---------- Tab Khám & chẩn đoán ----------
  const [diagnoses, setDiagnoses] = useState<Icd10[]>([]);
  const [icdCode, setIcdCode] = useState('');
  const [icdName, setIcdName] = useState('');
  const [note, setNote] = useState('');
  const [icdSearch, setIcdSearch] = useState('');

  const { data: icdOptions } = useQuery({
    queryKey: ['icd10', icdSearch],
    queryFn: async () =>
      (await api.get('/catalog/icd10', { params: icdSearch ? { q: icdSearch } : {} })).data.data as Icd10[],
    retry: false,
  });

  function addDiagnosis() {
    if (!icdCode.trim()) return;
    if (diagnoses.some((d) => d.code === icdCode.trim())) return;
    setDiagnoses([...diagnoses, { code: icdCode.trim(), name: icdName.trim() }]);
    setIcdCode('');
    setIcdName('');
  }

  const saveExam = useMutation({
    mutationFn: async () =>
      (
        await api.post(`/encounters/${id}/exam`, {
          icd10: diagnoses.map((d) => d.code),
          note,
        })
      ).data.data,
    onSuccess: () => message.success('Đã lưu khám & chẩn đoán'),
    onError: (e) => message.error(apiError(e)),
  });

  // ---------- Tab Kê đơn ----------
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [warnings, setWarnings] = useState<Warning[] | null>(null);
  const [itemForm] = Form.useForm();

  const { data: drugs, isError: drugsForbidden } = useQuery({
    queryKey: ['drugs'],
    queryFn: async () => (await api.get('/catalog/drugs')).data.data as Drug[],
    retry: false,
  });

  async function refreshPrescription(pid: string) {
    const p = (await api.get(`/prescriptions/${pid}`)).data.data as Prescription;
    setPrescription(p);
  }

  const createPrescription = useMutation({
    mutationFn: async () =>
      (await api.post(`/encounters/${id}/prescriptions`, {})).data.data as Prescription,
    onSuccess: (p) => {
      setPrescription({ ...p, items: [] });
      setWarnings(null);
      message.success('Đã tạo đơn thuốc');
    },
    onError: (e) => message.error(apiError(e)),
  });

  const addItem = useMutation({
    mutationFn: async (v: {
      drugId: string;
      dose: string;
      frequency: string;
      durationDays: number;
    }) => {
      if (!prescription) throw new Error('Chưa có đơn thuốc');
      return (await api.post(`/prescriptions/${prescription.id}/items`, v)).data.data;
    },
    onSuccess: async () => {
      message.success('Đã thêm thuốc');
      itemForm.resetFields();
      if (prescription) await refreshPrescription(prescription.id);
    },
    onError: (e) => message.error(apiError(e)),
  });

  const checkInteraction = useMutation({
    mutationFn: async () => {
      if (!prescription) throw new Error('Chưa có đơn thuốc');
      return (await api.post(`/prescriptions/${prescription.id}/check-interaction`, {})).data
        .data as Warning[];
    },
    onSuccess: (w) => {
      setWarnings(w);
      if (!w.length) message.success('Không phát hiện tương tác (mô phỏng)');
    },
    onError: (e) => message.error(apiError(e)),
  });

  const sign = useMutation({
    mutationFn: async () => {
      if (!prescription) throw new Error('Chưa có đơn thuốc');
      return (await api.post(`/prescriptions/${prescription.id}/sign`, {})).data.data as Prescription;
    },
    onSuccess: async () => {
      message.success('Đã ký đơn');
      if (prescription) await refreshPrescription(prescription.id);
    },
    onError: (e) => message.error(apiError(e)),
  });

  const isDraft = prescription?.status === 'DRAFT';

  const examTab = (
    <Card>
      <Space.Compact style={{ width: '100%', marginBottom: 8 }}>
        <Select
          showSearch
          placeholder="Tìm mã ICD-10 (hoặc nhập tay bên dưới)"
          style={{ width: '100%' }}
          filterOption={false}
          onSearch={setIcdSearch}
          onChange={(code) => {
            const found = (icdOptions ?? []).find((o) => o.code === code);
            setIcdCode(code);
            setIcdName(found?.name ?? '');
          }}
          options={(icdOptions ?? []).map((o) => ({ value: o.code, label: `${o.code} — ${o.name}` }))}
          notFoundContent={null}
        />
      </Space.Compact>
      <Space style={{ width: '100%', marginBottom: 12 }}>
        <Input placeholder="Mã ICD" value={icdCode} onChange={(e) => setIcdCode(e.target.value)} style={{ width: 140 }} />
        <Input placeholder="Tên chẩn đoán" value={icdName} onChange={(e) => setIcdName(e.target.value)} style={{ width: 280 }} />
        <Button icon={<PlusOutlined />} onClick={addDiagnosis}>
          Thêm
        </Button>
      </Space>
      <div style={{ marginBottom: 12 }}>
        {diagnoses.map((d) => (
          <Tag
            key={d.code}
            closable
            color="blue"
            onClose={() => setDiagnoses(diagnoses.filter((x) => x.code !== d.code))}
            style={{ marginBottom: 4 }}
          >
            {d.code} {d.name ? `— ${d.name}` : ''}
          </Tag>
        ))}
      </div>
      <Form layout="vertical">
        <Form.Item label="Ghi chú khám">
          <Input.TextArea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Triệu chứng, diễn biến..." />
        </Form.Item>
        <Button type="primary" loading={saveExam.isPending} onClick={() => saveExam.mutate()}>
          Lưu khám & chẩn đoán
        </Button>
      </Form>
    </Card>
  );

  const itemColumns = [
    { title: 'Thuốc', key: 'drug', render: (_: unknown, r: PrescriptionItem) => r.drug ? `${r.drug.code} — ${r.drug.name}` : '—' },
    { title: 'Liều', dataIndex: 'dose', key: 'dose' },
    { title: 'Tần suất', dataIndex: 'frequency', key: 'frequency' },
    { title: 'Số ngày', dataIndex: 'durationDays', key: 'durationDays' },
    { title: 'SL', dataIndex: 'quantity', key: 'quantity' },
  ];

  const statusTag = prescription
    ? STATUS_LABEL[prescription.status] ?? { text: prescription.status, color: 'default' }
    : null;

  const prescribeTab = (
    <Card>
      {!prescription ? (
        <Button type="primary" loading={createPrescription.isPending} onClick={() => createPrescription.mutate()}>
          Tạo đơn thuốc
        </Button>
      ) : (
        <>
          <Space style={{ marginBottom: 16 }}>
            <Typography.Text strong>Đơn thuốc</Typography.Text>
            {statusTag && <Tag color={statusTag.color}>{statusTag.text}</Tag>}
          </Space>

          {drugsForbidden && (
            <Alert
              style={{ marginBottom: 12 }}
              type="warning"
              message="Không tải được danh mục thuốc (có thể thiếu quyền). Nhập mã thuốc (drugId) thủ công — bản demo."
            />
          )}

          {isDraft && (
            <Form form={itemForm} layout="vertical" onFinish={(v) => addItem.mutate(v)}>
              <Space align="start" wrap>
                <Form.Item name="drugId" label="Thuốc" rules={[{ required: true, message: 'Chọn/nhập thuốc' }]}>
                  {drugs && !drugsForbidden ? (
                    <Select
                      showSearch
                      style={{ width: 280 }}
                      placeholder="Chọn thuốc"
                      optionFilterProp="label"
                      options={drugs.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }))}
                    />
                  ) : (
                    <Input style={{ width: 280 }} placeholder="drugId (nhập tay)" />
                  )}
                </Form.Item>
                <Form.Item name="dose" label="Liều" rules={[{ required: true, message: 'Nhập liều' }]}>
                  <Input style={{ width: 120 }} placeholder="500mg" />
                </Form.Item>
                <Form.Item name="frequency" label="Tần suất" rules={[{ required: true, message: 'Nhập tần suất' }]}>
                  <Input style={{ width: 140 }} placeholder="2 lần/ngày" />
                </Form.Item>
                <Form.Item name="durationDays" label="Số ngày" rules={[{ required: true, message: 'Nhập số ngày' }]}>
                  <InputNumber style={{ width: 100 }} min={1} />
                </Form.Item>
                <Form.Item label=" ">
                  <Button icon={<PlusOutlined />} htmlType="submit" loading={addItem.isPending}>
                    Thêm thuốc
                  </Button>
                </Form.Item>
              </Space>
            </Form>
          )}

          <Table
            rowKey="id"
            style={{ marginTop: 8 }}
            columns={itemColumns}
            dataSource={prescription.items ?? []}
            pagination={false}
            size="small"
          />

          <Space style={{ marginTop: 16 }}>
            <Button loading={checkInteraction.isPending} onClick={() => checkInteraction.mutate()}>
              Kiểm tra tương tác
            </Button>
            {isDraft && (
              <Button type="primary" loading={sign.isPending} onClick={() => sign.mutate()}>
                Ký đơn
              </Button>
            )}
          </Space>

          {warnings && (
            <Alert
              style={{ marginTop: 16 }}
              type={warnings.length ? 'warning' : 'success'}
              message={
                <Space>
                  {warnings.length ? 'Phát hiện tương tác' : 'Không phát hiện tương tác'}
                  <Tag color="purple">GỢI Ý AI — cần bác sĩ xác nhận</Tag>
                </Space>
              }
              description={
                warnings.length ? (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {warnings.map((w, i) => (
                      <li key={i}>
                        {w.pair.join(' + ')} ({w.severity}): {w.note}
                      </li>
                    ))}
                  </ul>
                ) : undefined
              }
            />
          )}
        </>
      )}
    </Card>
  );

  // ---------- Tab Chỉ định cận lâm sàng (U02.5) ----------
  const [orderForm] = Form.useForm();

  const { data: services, isError: servicesForbidden } = useQuery({
    queryKey: ['services'],
    queryFn: async () => (await api.get('/catalog/services')).data.data as Service[],
    retry: false,
  });

  const { data: orders } = useQuery({
    queryKey: ['orders', id],
    queryFn: async () => (await api.get(`/encounters/${id}/orders`)).data.data as Order[],
    enabled: !!id,
    retry: false,
  });

  const createOrder = useMutation({
    mutationFn: async (v: { type: 'LAB' | 'IMAGING'; serviceId?: string }) =>
      (await api.post(`/encounters/${id}/orders`, v)).data.data as Order,
    onSuccess: () => {
      message.success('Đã tạo chỉ định');
      orderForm.resetFields();
      qc.invalidateQueries({ queryKey: ['orders', id] });
    },
    onError: (e) => message.error(apiError(e)),
  });

  const resultOrder = useMutation({
    mutationFn: async (orderId: string) =>
      (await api.post(`/orders/${orderId}/result`, {})).data.data as Order,
    onSuccess: () => {
      message.success('Đã nhập kết quả (mô phỏng)');
      qc.invalidateQueries({ queryKey: ['orders', id] });
    },
    onError: (e) => message.error(apiError(e)),
  });

  const ORDER_TYPE_LABEL: Record<string, string> = { LAB: 'Xét nghiệm (LAB)', IMAGING: 'Chẩn đoán hình ảnh (IMAGING)' };
  const ORDER_STATUS_LABEL: Record<string, { text: string; color: string }> = {
    ORDERED: { text: 'Đã chỉ định', color: 'blue' },
    RESULTED: { text: 'Có kết quả', color: 'green' },
  };

  const orderColumns = [
    { title: 'Loại', dataIndex: 'type', key: 'type', render: (t: string) => ORDER_TYPE_LABEL[t] ?? t },
    {
      title: 'Dịch vụ',
      dataIndex: 'serviceId',
      key: 'serviceId',
      render: (sid?: string | null) => {
        if (!sid) return '—';
        const s = (services ?? []).find((x) => x.id === sid);
        return s ? `${s.code} — ${s.name}` : sid;
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (st: string) => {
        const tag = ORDER_STATUS_LABEL[st] ?? { text: st, color: 'default' };
        return <Tag color={tag.color}>{tag.text}</Tag>;
      },
    },
    {
      title: 'Kết quả',
      key: 'result',
      render: (_: unknown, r: Order) =>
        r.resultJson ? (
          <pre style={{ margin: 0, maxWidth: 360, whiteSpace: 'pre-wrap', fontSize: 12 }}>
            {(() => {
              try {
                return JSON.stringify(JSON.parse(r.resultJson), null, 2);
              } catch {
                return r.resultJson;
              }
            })()}
          </pre>
        ) : (
          '—'
        ),
    },
    {
      title: '',
      key: 'action',
      render: (_: unknown, r: Order) =>
        r.status === 'RESULTED' ? (
          <Tag color="purple">mô phỏng LIS/RIS</Tag>
        ) : (
          <Button
            size="small"
            loading={resultOrder.isPending && resultOrder.variables === r.id}
            onClick={() => resultOrder.mutate(r.id)}
          >
            Nhập kết quả (mô phỏng)
          </Button>
        ),
    },
  ];

  const ordersTab = (
    <Card>
      {servicesForbidden && (
        <Alert
          style={{ marginBottom: 12 }}
          type="warning"
          message="Không tải được danh mục dịch vụ (có thể thiếu quyền)."
        />
      )}
      <Form form={orderForm} layout="vertical" onFinish={(v) => createOrder.mutate(v)}>
        <Space align="start" wrap>
          <Form.Item name="type" label="Loại chỉ định" rules={[{ required: true, message: 'Chọn loại' }]}>
            <Select
              style={{ width: 240 }}
              placeholder="Chọn loại"
              options={[
                { value: 'LAB', label: 'Xét nghiệm (LAB)' },
                { value: 'IMAGING', label: 'Chẩn đoán hình ảnh (IMAGING)' },
              ]}
            />
          </Form.Item>
          <Form.Item name="serviceId" label="Dịch vụ">
            <Select
              showSearch
              allowClear
              style={{ width: 320 }}
              placeholder="Chọn dịch vụ"
              optionFilterProp="label"
              options={(services ?? []).map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }))}
            />
          </Form.Item>
          <Form.Item label=" ">
            <Button type="primary" icon={<PlusOutlined />} htmlType="submit" loading={createOrder.isPending}>
              Tạo chỉ định
            </Button>
          </Form.Item>
        </Space>
      </Form>

      <Table
        rowKey="id"
        style={{ marginTop: 8 }}
        columns={orderColumns}
        dataSource={orders ?? []}
        pagination={false}
        size="small"
      />
    </Card>
  );

  if (!id) return <Spin />;

  return (
    <div>
      <Typography.Title level={4}>Khám bệnh</Typography.Title>
      <Tabs
        items={[
          { key: 'exam', label: 'Khám & chẩn đoán', children: examTab },
          { key: 'prescribe', label: 'Kê đơn', children: prescribeTab },
          { key: 'orders', label: 'Chỉ định cận lâm sàng', children: ordersTab },
        ]}
      />
    </div>
  );
}

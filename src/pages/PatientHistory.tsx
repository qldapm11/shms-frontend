import { useState } from 'react';
import {
  Alert,
  Card,
  Collapse,
  Empty,
  Input,
  Space,
  Spin,
  Table,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { api, apiError } from '../api/client';
import axios from 'axios';

interface Diagnosis {
  id: string;
  icd10Code: string;
  type: string;
  note?: string | null;
}
interface Order {
  id: string;
  type: string;
  serviceId?: string | null;
  status: string;
  resultJson?: string | null;
}
interface Drug {
  code: string;
  name: string;
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
interface MedicalRecord {
  id: string;
  summary?: string | null;
  status: string;
}
interface Encounter {
  id: string;
  type: string;
  status: string;
  queueNo?: number | null;
  createdAt: string;
  diagnoses?: Diagnosis[];
  orders?: Order[];
  prescriptions?: Prescription[];
  medicalRecords?: MedicalRecord[];
}
interface Patient {
  id: string;
  code: string;
  fullName: string;
}
interface HistoryResult {
  patient: Patient;
  encounters: Encounter[];
}

const ENC_STATUS_LABEL: Record<string, { text: string; color: string }> = {
  WAITING: { text: 'Chờ khám', color: 'default' },
  IN_EXAM: { text: 'Đang khám', color: 'blue' },
  DONE: { text: 'Đã khám', color: 'green' },
  ADMITTED: { text: 'Nhập viện', color: 'orange' },
  DISCHARGED: { text: 'Ra viện', color: 'purple' },
};
const ORDER_TYPE_LABEL: Record<string, string> = { LAB: 'Xét nghiệm (LAB)', IMAGING: 'Hình ảnh (IMAGING)' };

function fmtDate(s: string): string {
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleString('vi-VN');
}

function EncounterDetail({ enc }: { enc: Encounter }) {
  const diagnoses = enc.diagnoses ?? [];
  const orders = enc.orders ?? [];
  const prescriptions = enc.prescriptions ?? [];
  const records = enc.medicalRecords ?? [];

  const presItemCols = [
    { title: 'Thuốc', key: 'drug', render: (_: unknown, r: PrescriptionItem) => (r.drug ? `${r.drug.code} — ${r.drug.name}` : '—') },
    { title: 'Liều', dataIndex: 'dose', key: 'dose' },
    { title: 'Tần suất', dataIndex: 'frequency', key: 'frequency' },
    { title: 'Số ngày', dataIndex: 'durationDays', key: 'durationDays' },
    { title: 'SL', dataIndex: 'quantity', key: 'quantity' },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div>
        <Typography.Text strong>Chẩn đoán</Typography.Text>
        <div style={{ marginTop: 4 }}>
          {diagnoses.length ? (
            diagnoses.map((d) => (
              <Tag key={d.id} color={d.type === 'PRIMARY' ? 'blue' : 'default'} style={{ marginBottom: 4 }}>
                {d.icd10Code} {d.type === 'PRIMARY' ? '(chính)' : '(phụ)'}
                {d.note ? ` — ${d.note}` : ''}
              </Tag>
            ))
          ) : (
            <Typography.Text type="secondary">Chưa có chẩn đoán</Typography.Text>
          )}
        </div>
      </div>

      <div>
        <Typography.Text strong>Chỉ định cận lâm sàng</Typography.Text>
        <div style={{ marginTop: 4 }}>
          {orders.length ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {orders.map((o) => (
                <li key={o.id}>
                  {ORDER_TYPE_LABEL[o.type] ?? o.type} — {o.status}
                  {o.resultJson ? ' (có kết quả)' : ''}
                </li>
              ))}
            </ul>
          ) : (
            <Typography.Text type="secondary">Chưa có chỉ định</Typography.Text>
          )}
        </div>
      </div>

      <div>
        <Typography.Text strong>Đơn thuốc</Typography.Text>
        <div style={{ marginTop: 4 }}>
          {prescriptions.length ? (
            prescriptions.map((p) => (
              <div key={p.id} style={{ marginBottom: 8 }}>
                <Space style={{ marginBottom: 4 }}>
                  <Tag color={p.status === 'SIGNED' ? 'green' : 'default'}>
                    {p.status === 'SIGNED' ? 'Đã ký' : p.status === 'DRAFT' ? 'Nháp' : p.status}
                  </Tag>
                </Space>
                <Table
                  rowKey="id"
                  columns={presItemCols}
                  dataSource={p.items ?? []}
                  pagination={false}
                  size="small"
                />
              </div>
            ))
          ) : (
            <Typography.Text type="secondary">Chưa có đơn thuốc</Typography.Text>
          )}
        </div>
      </div>

      <div>
        <Typography.Text strong>Bệnh án</Typography.Text>
        <div style={{ marginTop: 4 }}>
          {records.length ? (
            records.map((r) => (
              <div key={r.id} style={{ marginBottom: 4 }}>
                <Tag color={r.status === 'SIGNED' ? 'green' : 'default'}>
                  {r.status === 'SIGNED' ? 'Đã ký' : 'Đang mở'}
                </Tag>
                <Typography.Text>{r.summary || 'Chưa có tóm tắt'}</Typography.Text>
              </div>
            ))
          ) : (
            <Typography.Text type="secondary">Chưa có bệnh án</Typography.Text>
          )}
        </div>
      </div>
    </Space>
  );
}

export function PatientHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialId = searchParams.get('patientId') ?? '';
  const [patientId, setPatientId] = useState(initialId);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['patient-history', patientId],
    queryFn: async () =>
      (await api.get(`/patients/${patientId}/history`)).data.data as HistoryResult,
    enabled: !!patientId,
    retry: false,
  });

  const forbidden = axios.isAxiosError(error) && error.response?.status === 403;

  function onSearch(value: string) {
    const v = value.trim();
    setPatientId(v);
    if (v) setSearchParams({ patientId: v });
    else setSearchParams({});
  }

  return (
    <div>
      <Typography.Title level={4}>Lịch sử điều trị</Typography.Title>
      <Card>
        <Input.Search
          placeholder="Nhập mã người bệnh (ID)"
          allowClear
          defaultValue={initialId}
          enterButton="Xem lịch sử"
          onSearch={onSearch}
          style={{ maxWidth: 420, marginBottom: 16 }}
        />

        {!patientId && <Empty description="Nhập mã người bệnh để xem lịch sử điều trị" />}

        {patientId && isLoading && <Spin />}

        {patientId && isError && (
          <Alert
            type={forbidden ? 'error' : 'warning'}
            message={forbidden ? 'Không có quyền xem lịch sử (encounter.read)' : apiError(error)}
          />
        )}

        {patientId && data && (
          <>
            <Typography.Paragraph>
              <Typography.Text strong>{data.patient.fullName}</Typography.Text>{' '}
              <Typography.Text type="secondary">({data.patient.code})</Typography.Text>
            </Typography.Paragraph>

            {data.encounters.length ? (
              <Timeline
                items={data.encounters.map((enc) => {
                  const st = ENC_STATUS_LABEL[enc.status] ?? { text: enc.status, color: 'default' };
                  return {
                    color: st.color === 'default' ? 'gray' : st.color,
                    children: (
                      <Collapse
                        items={[
                          {
                            key: enc.id,
                            label: (
                              <Space>
                                <Typography.Text strong>{fmtDate(enc.createdAt)}</Typography.Text>
                                <Tag color={st.color}>{st.text}</Tag>
                                <Typography.Text type="secondary">
                                  {enc.type === 'INPATIENT' ? 'Nội trú' : 'Ngoại trú'}
                                  {enc.queueNo ? ` · STT ${enc.queueNo}` : ''}
                                </Typography.Text>
                              </Space>
                            ),
                            children: <EncounterDetail enc={enc} />,
                          },
                        ]}
                      />
                    ),
                  };
                })}
              />
            ) : (
              <Empty description="Người bệnh chưa có lượt khám nào" />
            )}
          </>
        )}
      </Card>
    </div>
  );
}

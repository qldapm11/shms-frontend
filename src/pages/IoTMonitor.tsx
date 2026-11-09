import { useState } from 'react';
import {
  Card, Col, Row, Table, Button, Tag, Typography, Spin, Alert, Space, Select, Input, Empty, App,
} from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { api, apiError } from '../api/client';

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
interface TrendPoint {
  t: string;
  hr: number | null;
  spo2: number | null;
  temp: number | null;
  bpSys: number | null;
  bpDia: number | null;
}
interface Alertitem {
  admissionId: string;
  type: 'THRESHOLD' | 'SIGNAL_LOST';
  metric?: string;
  value?: number | null;
  minVal?: number | null;
  maxVal?: number | null;
  severity: string;
  measuredAt?: string;
  message: string;
}
interface Fridge {
  code: string;
  name: string;
  temp: number;
  unit: string;
  targetMin: number;
  targetMax: number;
  status: 'OK' | 'ALERT';
}
interface Admission {
  id: string;
  bed?: { code?: string } | null;
  encounter?: { patient?: { fullName?: string } | null } | null;
}

const SIM_TAG = <Tag color="purple">mô phỏng</Tag>;

function trendText(points: TrendPoint[], key: keyof TrendPoint): string {
  const vals = points
    .map((p) => p[key])
    .filter((v): v is number => typeof v === 'number');
  if (vals.length < 2) return 'chưa đủ dữ liệu';
  const first = vals[0];
  const last = vals[vals.length - 1];
  const diff = last - first;
  if (Math.abs(diff) < 0.1) return 'ổn định';
  return diff > 0 ? `tăng (${first} → ${last})` : `giảm (${first} → ${last})`;
}

export function IoTMonitorPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [admissionId, setAdmissionId] = useState<string | undefined>();

  // Danh sách lượt nằm viện để chọn; nếu thiếu quyền thì cho nhập tay.
  const admissions = useQuery({
    queryKey: ['iot', 'admissions'],
    queryFn: async () =>
      (await api.get('/admissions', { params: { status: 'ADMITTED' } })).data as Admission[],
    retry: false,
  });
  const admForbidden =
    axios.isAxiosError(admissions.error) && admissions.error.response?.status === 403;

  const vitals = useQuery({
    queryKey: ['iot', 'vitals', admissionId],
    enabled: !!admissionId,
    queryFn: async () =>
      (await api.get(`/iot/vitals/${admissionId}`)).data as {
        source: string;
        count: number;
        items: VitalSign[];
      },
  });

  const trend = useQuery({
    queryKey: ['iot', 'trend', admissionId],
    enabled: !!admissionId,
    queryFn: async () =>
      (await api.get(`/iot/vitals/${admissionId}/trend`)).data as {
        source: string;
        points: TrendPoint[];
      },
  });

  const alerts = useQuery({
    queryKey: ['iot', 'alerts'],
    queryFn: async () =>
      (await api.get('/iot/alerts')).data as {
        alertCount: number;
        alerts: Alertitem[];
      },
  });

  const fridge = useQuery({
    queryKey: ['iot', 'fridge'],
    queryFn: async () =>
      (await api.get('/iot/fridge')).data as { measuredAt: string; fridges: Fridge[] },
  });

  const simulate = useMutation({
    mutationFn: async (id: string) =>
      (await api.post('/iot/vitals/simulate', { admissionId: id })).data,
    onSuccess: () => {
      message.success('Đã sinh dấu hiệu sinh tồn mô phỏng');
      qc.invalidateQueries({ queryKey: ['iot', 'vitals', admissionId] });
      qc.invalidateQueries({ queryKey: ['iot', 'trend', admissionId] });
      qc.invalidateQueries({ queryKey: ['iot', 'alerts'] });
    },
    onError: (e) => message.error(apiError(e)),
  });

  const vitalsForbidden =
    axios.isAxiosError(vitals.error) && vitals.error.response?.status === 403;

  if (vitalsForbidden) {
    return (
      <Alert
        type="warning"
        showIcon
        message="Không đủ quyền"
        description="Bạn không có quyền xem dữ liệu sinh tồn (vitals.read)."
      />
    );
  }

  const points = trend.data?.points ?? [];

  return (
    <div>
      <Space style={{ marginBottom: 16 }} align="center" wrap>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Giám sát IoT
        </Typography.Title>
        {SIM_TAG}
        <Typography.Text type="secondary">
          Toàn bộ số liệu dưới đây là dữ liệu mô phỏng, không dùng cho quyết định lâm sàng.
        </Typography.Text>
      </Space>

      <Space style={{ marginBottom: 16 }} wrap>
        {admForbidden ? (
          <Input
            placeholder="Nhập admissionId"
            allowClear
            style={{ width: 280 }}
            onChange={(e) => setAdmissionId(e.target.value || undefined)}
          />
        ) : (
          <Select
            style={{ width: 360 }}
            placeholder="Chọn lượt nằm viện"
            loading={admissions.isLoading}
            allowClear
            showSearch
            optionFilterProp="label"
            value={admissionId}
            onChange={(v) => setAdmissionId(v)}
            options={(admissions.data ?? []).map((a) => ({
              value: a.id,
              label: `${a.encounter?.patient?.fullName ?? '(không rõ)'} — giường ${a.bed?.code ?? '?'}`,
            }))}
          />
        )}
        <Button
          type="primary"
          disabled={!admissionId}
          loading={simulate.isPending}
          onClick={() => admissionId && simulate.mutate(admissionId)}
        >
          Mô phỏng sinh hiệu
        </Button>
      </Space>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title={<Space>Dấu hiệu sinh tồn {SIM_TAG}</Space>} size="small">
            {!admissionId ? (
              <Empty description="Chọn lượt nằm viện để xem" />
            ) : vitals.isLoading ? (
              <Spin />
            ) : (
              <Table<VitalSign>
                rowKey="id"
                size="small"
                dataSource={vitals.data?.items ?? []}
                pagination={{ pageSize: 8 }}
                columns={[
                  {
                    title: 'Thời điểm',
                    dataIndex: 'measuredAt',
                    render: (t: string) => new Date(t).toLocaleString('vi-VN'),
                  },
                  { title: 'Nhịp tim', dataIndex: 'hr' },
                  { title: 'SpO2', dataIndex: 'spo2' },
                  { title: 'Nhiệt độ', dataIndex: 'temp' },
                  { title: 'HA tâm thu', dataIndex: 'bpSys' },
                  { title: 'HA tâm trương', dataIndex: 'bpDia' },
                  {
                    title: 'Nguồn',
                    dataIndex: 'source',
                    render: (s: string) => <Tag>{s}</Tag>,
                  },
                ]}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title={<Space>Xu hướng {SIM_TAG}</Space>} size="small" style={{ marginBottom: 16 }}>
            {!admissionId ? (
              <Empty description="Chưa chọn" />
            ) : points.length === 0 ? (
              <Empty description="Chưa có dữ liệu xu hướng" />
            ) : (
              <ul style={{ paddingLeft: 18, margin: 0 }}>
                <li>Nhịp tim: {trendText(points, 'hr')}</li>
                <li>SpO2: {trendText(points, 'spo2')}</li>
                <li>Nhiệt độ: {trendText(points, 'temp')}</li>
                <li>HA tâm thu: {trendText(points, 'bpSys')}</li>
                <li>HA tâm trương: {trendText(points, 'bpDia')}</li>
              </ul>
            )}
          </Card>

          <Card title={<Space>Nhiệt độ kho thuốc {SIM_TAG}</Space>} size="small">
            {fridge.isLoading ? (
              <Spin />
            ) : (
              (fridge.data?.fridges ?? []).map((f) => (
                <div
                  key={f.code}
                  style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}
                >
                  <Typography.Text>{f.name}</Typography.Text>
                  <Space>
                    <Typography.Text strong>
                      {f.temp}
                      {f.unit}
                    </Typography.Text>
                    <Tag color={f.status === 'OK' ? 'green' : 'red'}>
                      {f.status === 'OK' ? 'Đạt' : 'Vượt ngưỡng'}
                    </Tag>
                  </Space>
                </div>
              ))
            )}
          </Card>
        </Col>

        <Col xs={24}>
          <Card title={<Space>Cảnh báo IoT {SIM_TAG}</Space>} size="small">
            {alerts.isLoading ? (
              <Spin />
            ) : (
              <Table<Alertitem>
                rowKey={(r, i) => `${r.admissionId}-${r.metric ?? r.type}-${i}`}
                size="small"
                dataSource={alerts.data?.alerts ?? []}
                locale={{ emptyText: 'Không có cảnh báo' }}
                pagination={{ pageSize: 8 }}
                columns={[
                  {
                    title: 'Loại',
                    dataIndex: 'type',
                    render: (t: string) => (
                      <Tag color={t === 'SIGNAL_LOST' ? 'orange' : 'red'}>
                        {t === 'SIGNAL_LOST' ? 'Mất tín hiệu' : 'Vượt ngưỡng'}
                      </Tag>
                    ),
                  },
                  {
                    title: 'Mức độ',
                    dataIndex: 'severity',
                    render: (s: string) => (
                      <Tag color={s === 'CRITICAL' ? 'red' : s === 'WARN' ? 'orange' : 'blue'}>{s}</Tag>
                    ),
                  },
                  { title: 'Nội dung', dataIndex: 'message' },
                  {
                    title: 'Thời điểm',
                    dataIndex: 'measuredAt',
                    render: (t?: string) => (t ? new Date(t).toLocaleString('vi-VN') : '—'),
                  },
                ]}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}

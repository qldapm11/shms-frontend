import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Input,
  Space,
  Tag,
  Typography,
  Spin,
  App,
} from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { api, apiError } from '../api/client';

interface MedicalRecord {
  id: string;
  patientId: string;
  encounterId: string;
  status: 'OPEN' | 'SIGNED';
  summary: string | null;
  signedBy: string | null;
  signedAt: string | null;
}

const STATUS_META: Record<string, { text: string; color: string }> = {
  OPEN: { text: 'Đang mở (OPEN)', color: 'blue' },
  SIGNED: { text: 'Đã ký (SIGNED)', color: 'green' },
};

export function MedicalRecordPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const queryEnc = searchParams.get('encounterId') ?? '';

  const [encInput, setEncInput] = useState(queryEnc);
  const [encounterId, setEncounterId] = useState(queryEnc);
  const [summary, setSummary] = useState('');

  const { data: record, isLoading, isFetching, error } = useQuery({
    queryKey: ['medical-record', encounterId],
    enabled: !!encounterId,
    queryFn: async () =>
      (await api.get(`/encounters/${encounterId}/medical-record`)).data.data as MedicalRecord,
  });

  // Đồng bộ nội dung summary vào ô soạn thảo khi tải được bệnh án.
  useEffect(() => {
    if (record) setSummary(record.summary ?? '');
  }, [record]);

  const save = useMutation({
    mutationFn: async () => {
      if (!record) throw new Error('Chưa có bệnh án');
      return (await api.patch(`/medical-records/${record.id}`, { summary })).data.data as MedicalRecord;
    },
    onSuccess: () => {
      message.success('Đã lưu tóm tắt bệnh án');
      qc.invalidateQueries({ queryKey: ['medical-record', encounterId] });
    },
    onError: (e) => message.error(apiError(e)),
  });

  const sign = useMutation({
    mutationFn: async () => {
      if (!record) throw new Error('Chưa có bệnh án');
      return (await api.post(`/medical-records/${record.id}/sign`, {})).data.data as MedicalRecord;
    },
    onSuccess: () => {
      message.success('Đã ký bệnh án, không thể sửa');
      qc.invalidateQueries({ queryKey: ['medical-record', encounterId] });
    },
    onError: (e) => message.error(apiError(e)),
  });

  const isSigned = record?.status === 'SIGNED';
  const statusMeta = record ? STATUS_META[record.status] ?? { text: record.status, color: 'default' } : null;

  return (
    <div>
      <Typography.Title level={4}>Bệnh án</Typography.Title>

      <Space.Compact style={{ marginBottom: 16, width: '100%', maxWidth: 560 }}>
        <Input
          placeholder="Nhập encounterId (mã lượt khám)"
          value={encInput}
          onChange={(e) => setEncInput(e.target.value)}
          onPressEnter={() => setEncounterId(encInput.trim())}
        />
        <Button type="primary" onClick={() => setEncounterId(encInput.trim())}>
          Tải bệnh án
        </Button>
      </Space.Compact>

      {!encounterId ? (
        <Alert type="info" message="Nhập encounterId để xem/soạn bệnh án" />
      ) : isLoading || isFetching ? (
        <Spin />
      ) : error ? (
        <Alert type="error" message={apiError(error)} />
      ) : record ? (
        <Card>
          <Descriptions
            size="small"
            column={1}
            style={{ marginBottom: 16 }}
            items={[
              {
                key: 'status',
                label: 'Trạng thái',
                children: statusMeta ? <Tag color={statusMeta.color}>{statusMeta.text}</Tag> : '—',
              },
              { key: 'enc', label: 'Lượt khám', children: record.encounterId },
              {
                key: 'signedAt',
                label: 'Ký lúc',
                children: record.signedAt ? new Date(record.signedAt).toLocaleString('vi-VN') : '—',
              },
            ]}
          />

          {isSigned && (
            <Alert
              style={{ marginBottom: 12 }}
              type="success"
              message="Bệnh án đã ký — chỉ xem, không thể chỉnh sửa"
            />
          )}

          <Typography.Text strong>Tóm tắt bệnh án</Typography.Text>
          <Input.TextArea
            rows={10}
            style={{ marginTop: 8 }}
            value={summary}
            disabled={isSigned}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Diễn biến, chẩn đoán, hướng điều trị..."
          />

          {!isSigned && (
            <Space style={{ marginTop: 16 }}>
              <Button type="primary" loading={save.isPending} onClick={() => save.mutate()}>
                Lưu tóm tắt
              </Button>
              <Button danger loading={sign.isPending} onClick={() => sign.mutate()}>
                Ký bệnh án
              </Button>
            </Space>
          )}
        </Card>
      ) : null}
    </div>
  );
}

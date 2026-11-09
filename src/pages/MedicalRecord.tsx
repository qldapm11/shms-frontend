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

const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

// Dựng HTML bản in bệnh án từ dữ liệu lịch sử của người bệnh, mở cửa sổ mới và gọi in.
function printMedicalRecord(history: any, encounterId: string, summary: string) {
  const p = history?.patient ?? {};
  const enc = (history?.encounters ?? []).find((e: any) => e.id === encounterId) ?? {};
  const dx = (enc.diagnoses ?? [])
    .map((d: any) => `<li>${esc(d.icdCode ?? '')} — ${esc(d.note ?? d.name ?? '')}</li>`)
    .join('');
  const rx = (enc.prescriptions ?? [])
    .flatMap((pr: any) => pr.items ?? [])
    .map((it: any) => `<tr><td>${esc(it.drug?.name ?? it.drugId ?? '')}</td><td>${esc(it.dose ?? '')}</td><td>${esc(it.quantity ?? '')}</td></tr>`)
    .join('');
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Bệnh án ${esc(p.fullName ?? '')}</title>
<style>
  body{font-family:'Times New Roman',serif;margin:32px;color:#000;line-height:1.5}
  h1{text-align:center;font-size:18px;margin:0 0 4px}
  .sub{text-align:center;font-size:13px;margin-bottom:20px}
  table{border-collapse:collapse;width:100%;margin:8px 0}
  td,th{border:1px solid #333;padding:6px 8px;font-size:13px;text-align:left}
  .row{display:flex;gap:40px;font-size:14px;margin:4px 0}
  h2{font-size:14px;border-bottom:1px solid #333;margin-top:18px;padding-bottom:3px}
  .summary{white-space:pre-wrap;font-size:14px;border:1px solid #333;padding:10px;min-height:80px}
  .sign{margin-top:36px;text-align:right;font-size:13px}
  @media print{body{margin:12mm}}
</style></head><body>
<h1>BỆNH ÁN</h1>
<div class="sub">Hệ thống Quản lý Bệnh viện Thông minh (SHMS)</div>
<div class="row"><div><b>Họ tên:</b> ${esc(p.fullName ?? '—')}</div><div><b>Giới tính:</b> ${esc(p.gender ?? '—')}</div><div><b>Ngày sinh:</b> ${p.dob ? new Date(p.dob).toLocaleDateString('vi-VN') : '—'}</div></div>
<div class="row"><div><b>Mã BN:</b> ${esc(p.code ?? p.id ?? '—')}</div><div><b>Thẻ BHYT:</b> ${esc(p.bhytCardNo ?? '—')}</div><div><b>Lượt khám:</b> ${esc(encounterId)}</div></div>
<h2>Chẩn đoán</h2><ul>${dx || '<li>—</li>'}</ul>
<h2>Đơn thuốc</h2><table><thead><tr><th>Thuốc</th><th>Liều dùng</th><th>Số lượng</th></tr></thead><tbody>${rx || '<tr><td colspan="3">—</td></tr>'}</tbody></table>
<h2>Tóm tắt điều trị</h2><div class="summary">${esc(summary) || '—'}</div>
<div class="sign">Ngày in: ${new Date().toLocaleString('vi-VN')}<br><br>Bác sĩ điều trị<br>(Ký, ghi rõ họ tên)</div>
</body></html>`;
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.onload = () => { w.print(); };
  // Dự phòng khi onload không kích hoạt (nội dung tĩnh).
  setTimeout(() => w.print(), 300);
  return true;
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

  const print = useMutation({
    mutationFn: async () => {
      if (!record) throw new Error('Chưa có bệnh án');
      return (await api.get(`/patients/${record.patientId}/history`)).data.data;
    },
    onSuccess: (history) => {
      const ok = printMedicalRecord(history, encounterId, summary);
      if (!ok) message.error('Trình duyệt chặn cửa sổ in. Hãy cho phép pop-up rồi thử lại.');
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

          <Space style={{ marginTop: 16 }}>
            {!isSigned && (
              <>
                <Button type="primary" loading={save.isPending} onClick={() => save.mutate()}>
                  Lưu tóm tắt
                </Button>
                <Button danger loading={sign.isPending} onClick={() => sign.mutate()}>
                  Ký bệnh án
                </Button>
              </>
            )}
            <Button loading={print.isPending} onClick={() => print.mutate()}>
              In bệnh án
            </Button>
          </Space>
        </Card>
      ) : null}
    </div>
  );
}

import { useState } from 'react';
import { Table, Button, Typography, Spin, Alert, Space, DatePicker, App } from 'antd';
import { useQuery } from '@tanstack/react-query';
import dayjs, { Dayjs } from 'dayjs';
import axios from 'axios';
import { api, apiError } from '../api/client';

interface DeptRow {
  departmentId: string | null;
  code: string | null;
  name: string;
  encounters: number;
}

const { RangePicker } = DatePicker;

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Mở cửa sổ in báo cáo theo khoa; người dùng chọn "Lưu dạng PDF" trong hộp thoại in.
function printReport(rows: DeptRow[], from?: string, to?: string) {
  const total = rows.reduce((s, r) => s + (r.encounters ?? 0), 0);
  const body = rows
    .map((r) => `<tr><td>${esc(r.code ?? '—')}</td><td>${esc(r.name)}</td><td style="text-align:right">${esc(r.encounters)}</td></tr>`)
    .join('');
  const period = `${from ? new Date(from).toLocaleDateString('vi-VN') : '—'} – ${to ? new Date(to).toLocaleDateString('vi-VN') : '—'}`;
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Báo cáo theo khoa</title>
<style>
  body{font-family:'Times New Roman',serif;margin:28px;color:#000}
  h1{text-align:center;font-size:18px;margin:0 0 4px}
  .sub{text-align:center;font-size:13px;margin-bottom:18px}
  table{border-collapse:collapse;width:100%}
  td,th{border:1px solid #333;padding:6px 10px;font-size:13px}
  th{background:#f0f0f0}
  tfoot td{font-weight:bold}
  @media print{body{margin:12mm}}
</style></head><body>
<h1>BÁO CÁO SỐ LƯỢT KHÁM THEO KHOA</h1>
<div class="sub">Kỳ báo cáo: ${period} · In lúc ${new Date().toLocaleString('vi-VN')}</div>
<table><thead><tr><th>Mã khoa</th><th>Tên khoa</th><th style="text-align:right">Số lượt khám</th></tr></thead>
<tbody>${body || '<tr><td colspan="3">Không có dữ liệu</td></tr>'}</tbody>
<tfoot><tr><td colspan="2">Tổng cộng</td><td style="text-align:right">${total}</td></tr></tfoot></table>
</body></html>`;
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.onload = () => w.print();
  setTimeout(() => w.print(), 300);
}

export function ReportsPage() {
  const { message } = App.useApp();
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>([
    dayjs().startOf('month'),
    dayjs().endOf('day'),
  ]);
  const [exporting, setExporting] = useState(false);

  const from = range?.[0]?.startOf('day').toISOString();
  const to = range?.[1]?.endOf('day').toISOString();

  const report = useQuery({
    queryKey: ['reports', 'by-department', from, to],
    queryFn: async () =>
      (await api.get('/reports/by-department', { params: { from, to } })).data as {
        from: string | null;
        to: string | null;
        rows: DeptRow[];
      },
  });

  const forbidden =
    axios.isAxiosError(report.error) && report.error.response?.status === 403;

  async function exportCsv() {
    setExporting(true);
    try {
      const resp = await api.get('/reports/export', {
        params: { format: 'csv', from, to },
        responseType: 'blob',
      });
      const blob = new Blob([resp.data], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bao-cao-theo-khoa.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      message.success('Đã tải tệp CSV');
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 403) {
        message.error('Không đủ quyền xuất báo cáo');
      } else {
        message.error(apiError(e));
      }
    } finally {
      setExporting(false);
    }
  }

  if (forbidden) {
    return (
      <Alert
        type="warning"
        showIcon
        message="Không đủ quyền"
        description="Bạn không có quyền xem báo cáo (report.read)."
      />
    );
  }
  if (report.isLoading) return <Spin />;
  if (report.error) return <Alert type="error" message="Không tải được báo cáo theo khoa" />;

  const rows = report.data?.rows ?? [];

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }} wrap>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Báo cáo theo khoa
        </Typography.Title>
        <Space wrap>
          <RangePicker
            value={range as any}
            onChange={(v) => setRange(v as [Dayjs, Dayjs] | null)}
            allowClear
          />
          <Button type="primary" loading={exporting} onClick={exportCsv}>
            Xuất CSV
          </Button>
          <Button onClick={() => printReport(rows, from, to)}>
            In / Lưu PDF
          </Button>
        </Space>
      </Space>

      <Table
        rowKey={(r) => r.departmentId ?? '(none)'}
        dataSource={rows}
        pagination={false}
        summary={(data) => {
          const total = data.reduce((s, r) => s + (r.encounters ?? 0), 0);
          return (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={2}>
                <Typography.Text strong>Tổng cộng</Typography.Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2}>
                <Typography.Text strong>{total}</Typography.Text>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          );
        }}
        columns={[
          { title: 'Mã khoa', dataIndex: 'code', render: (c: string | null) => c ?? '—' },
          { title: 'Tên khoa', dataIndex: 'name' },
          {
            title: 'Số lượt khám',
            dataIndex: 'encounters',
            align: 'right' as const,
            sorter: (a: DeptRow, b: DeptRow) => a.encounters - b.encounters,
          },
        ]}
      />
    </div>
  );
}

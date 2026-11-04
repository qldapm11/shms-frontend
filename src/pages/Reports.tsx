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

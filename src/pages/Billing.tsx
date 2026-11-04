import { useState } from 'react';
import {
  Table, Button, Tag, Typography, Spin, Alert, Drawer, Descriptions, Space,
  InputNumber, App,
} from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiError } from '../api/client';

interface Invoice {
  id: string;
  status: 'DRAFT' | 'ISSUED' | 'PAID' | 'PARTIAL';
  total: number;
  bhytPart: number;
  patientPart: number;
  createdAt: string;
  encounter?: { patient?: { fullName?: string; code?: string } | null } | null;
}
interface InvoiceItem {
  id: string;
  refType: string;
  refId: string;
  qty: number;
  unitPrice: number;
  amount: number;
}
interface InvoiceDetail extends Invoice {
  items: InvoiceItem[];
  payments: { id: string; amount: number; method: string; receiptNo: string }[];
}

const STATUS_COLOR: Record<Invoice['status'], string> = {
  DRAFT: 'default',
  ISSUED: 'blue',
  PAID: 'green',
  PARTIAL: 'orange',
};

const fmt = (n: number) => (n ?? 0).toLocaleString('vi-VN') + ' đ';

export function BillingPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState<number | null>(null);

  const list = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => (await api.get('/invoices')).data.invoices as Invoice[],
  });

  const detail = useQuery({
    queryKey: ['invoice', selectedId],
    enabled: !!selectedId,
    queryFn: async () => (await api.get(`/invoices/${selectedId}`)).data.invoice as InvoiceDetail,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['invoices'] });
    if (selectedId) qc.invalidateQueries({ queryKey: ['invoice', selectedId] });
  };

  const issue = useMutation({
    mutationFn: async (id: string) => (await api.post(`/invoices/${id}/issue`)).data,
    onSuccess: () => { message.success('Đã phát hành hóa đơn'); refresh(); },
    onError: (e) => message.error(apiError(e)),
  });

  const pay = useMutation({
    mutationFn: async (vars: { id: string; amount: number }) =>
      (await api.post(`/invoices/${vars.id}/payment`, { amount: vars.amount, method: 'CASH' })).data,
    onSuccess: () => { message.success('Đã thu tiền'); setPayAmount(null); refresh(); },
    onError: (e) => message.error(apiError(e)),
  });

  if (list.isLoading) return <Spin />;
  if (list.error) return <Alert type="error" message="Không tải được danh sách hóa đơn" />;

  const d = detail.data;

  return (
    <div>
      <Typography.Title level={4}>Viện phí</Typography.Title>
      <Table
        rowKey="id"
        dataSource={list.data ?? []}
        columns={[
          { title: 'Người bệnh', render: (_, r: Invoice) => r.encounter?.patient?.fullName ?? '—' },
          { title: 'Tổng', dataIndex: 'total', render: fmt },
          { title: 'Người bệnh trả', dataIndex: 'patientPart', render: fmt },
          {
            title: 'Trạng thái',
            dataIndex: 'status',
            render: (s: Invoice['status']) => <Tag color={STATUS_COLOR[s]}>{s}</Tag>,
          },
          {
            title: 'Thao tác',
            render: (_, r: Invoice) => (
              <Button size="small" onClick={() => { setSelectedId(r.id); setPayAmount(null); }}>
                Xem
              </Button>
            ),
          },
        ]}
      />

      <Drawer
        title="Chi tiết hóa đơn"
        width={520}
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
      >
        {detail.isLoading && <Spin />}
        {d && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Người bệnh">
                {d.encounter?.patient?.fullName ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Tag color={STATUS_COLOR[d.status]}>{d.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Tổng">{fmt(d.total)}</Descriptions.Item>
              <Descriptions.Item label="BHYT chi trả">{fmt(d.bhytPart)}</Descriptions.Item>
              <Descriptions.Item label="Người bệnh trả">{fmt(d.patientPart)}</Descriptions.Item>
            </Descriptions>

            <Table
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={d.items}
              columns={[
                { title: 'Loại', dataIndex: 'refType' },
                { title: 'SL', dataIndex: 'qty' },
                { title: 'Đơn giá', dataIndex: 'unitPrice', render: fmt },
                { title: 'Thành tiền', dataIndex: 'amount', render: fmt },
              ]}
            />

            <Space>
              {d.status === 'DRAFT' && (
                <Button
                  type="primary"
                  loading={issue.isPending}
                  onClick={() => issue.mutate(d.id)}
                >
                  Phát hành
                </Button>
              )}
              {(d.status === 'ISSUED' || d.status === 'PARTIAL') && (
                <>
                  <InputNumber
                    min={1}
                    placeholder="Số tiền"
                    value={payAmount ?? undefined}
                    onChange={(v) => setPayAmount(v)}
                    style={{ width: 160 }}
                    formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  />
                  <Button
                    type="primary"
                    loading={pay.isPending}
                    disabled={!payAmount}
                    onClick={() => payAmount && pay.mutate({ id: d.id, amount: payAmount })}
                  >
                    Thu tiền
                  </Button>
                </>
              )}
            </Space>
          </Space>
        )}
      </Drawer>
    </div>
  );
}

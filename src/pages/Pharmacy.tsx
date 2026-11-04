import { Tabs, Table, Button, Tag, Typography, Spin, Alert, Space } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { api, apiError } from '../api/client';

interface PrescItem {
  id: string;
  quantity: number;
  drug?: { code?: string; name?: string } | null;
}
interface Prescription {
  id: string;
  status: string;
  createdAt: string;
  items: PrescItem[];
  encounter?: { patient?: { fullName?: string; code?: string } | null } | null;
}

interface Lot {
  id: string;
  lotNo: string;
  qty: number;
  warehouse: string;
  expiryDate: string | null;
  daysToExpiry: number | null;
  expiringSoon: boolean;
}
interface InventoryRow {
  drugId: string;
  drugCode: string;
  drugName: string;
  totalQty: number;
  lots: Lot[];
}

function PendingPrescriptions() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['pharmacy', 'prescriptions'],
    queryFn: async () => (await api.get('/pharmacy/prescriptions')).data.prescriptions as Prescription[],
  });

  const dispense = useMutation({
    mutationFn: async (id: string) => (await api.post(`/prescriptions/${id}/dispense`)).data,
    onSuccess: () => {
      message.success('Đã cấp phát đơn thuốc');
      qc.invalidateQueries({ queryKey: ['pharmacy', 'prescriptions'] });
      qc.invalidateQueries({ queryKey: ['pharmacy', 'inventory'] });
    },
    onError: (e) => message.error(apiError(e)),
  });

  if (isLoading) return <Spin />;
  if (error) return <Alert type="error" message="Không tải được đơn chờ cấp phát" />;

  return (
    <Table
      rowKey="id"
      dataSource={data ?? []}
      pagination={false}
      columns={[
        {
          title: 'Người bệnh',
          render: (_, r: Prescription) => r.encounter?.patient?.fullName ?? '—',
        },
        {
          title: 'Thuốc',
          render: (_, r: Prescription) => (
            <Space direction="vertical" size={0}>
              {r.items.map((it) => (
                <span key={it.id}>{it.drug?.name ?? it.drug?.code ?? it.id} × {it.quantity}</span>
              ))}
            </Space>
          ),
        },
        { title: 'Trạng thái', dataIndex: 'status', render: (s: string) => <Tag color="orange">{s}</Tag> },
        {
          title: 'Thao tác',
          render: (_, r: Prescription) => (
            <Button
              type="primary"
              size="small"
              loading={dispense.isPending && dispense.variables === r.id}
              onClick={() => dispense.mutate(r.id)}
            >
              Cấp phát
            </Button>
          ),
        },
      ]}
    />
  );
}

function Inventory() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['pharmacy', 'inventory'],
    queryFn: async () => (await api.get('/pharmacy/inventory')).data.inventory as InventoryRow[],
  });

  if (isLoading) return <Spin />;
  if (error) return <Alert type="error" message="Không tải được tồn kho" />;

  return (
    <Table
      rowKey="drugId"
      dataSource={data ?? []}
      pagination={false}
      columns={[
        { title: 'Mã thuốc', dataIndex: 'drugCode' },
        { title: 'Tên thuốc', dataIndex: 'drugName' },
        { title: 'Tổng tồn', dataIndex: 'totalQty' },
        {
          title: 'Lô / hạn dùng',
          render: (_, r: InventoryRow) => (
            <Space direction="vertical" size={2}>
              {r.lots.map((l) => (
                <span key={l.id}>
                  {l.lotNo} ({l.qty}){' '}
                  {l.expiryDate ? new Date(l.expiryDate).toLocaleDateString('vi-VN') : '—'}{' '}
                  {l.expiringSoon && (
                    <Tag color="red">Sắp hết hạn{l.daysToExpiry !== null ? ` (${l.daysToExpiry} ngày)` : ''}</Tag>
                  )}
                </span>
              ))}
            </Space>
          ),
        },
      ]}
    />
  );
}

export function PharmacyPage() {
  return (
    <div>
      <Typography.Title level={4}>Dược</Typography.Title>
      <Tabs
        items={[
          { key: 'presc', label: 'Đơn chờ cấp phát', children: <PendingPrescriptions /> },
          { key: 'inv', label: 'Tồn kho', children: <Inventory /> },
        ]}
      />
    </div>
  );
}

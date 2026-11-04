import { Button, Card, Table, Tag, Typography, App } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, apiError } from '../api/client';

interface QueueEncounter {
  id: string;
  queueNo: number;
  status: string;
  createdAt: string;
  patient?: { code: string; fullName: string } | null;
}

export function DoctorQueuePage() {
  const { message } = App.useApp();
  const nav = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['doctor-queue'],
    queryFn: async () => (await api.get('/encounters/queue')).data.data as QueueEncounter[],
    refetchInterval: 15000,
  });

  const columns = [
    { title: 'STT', dataIndex: 'queueNo', key: 'queueNo', width: 80 },
    {
      title: 'Mã người bệnh',
      key: 'code',
      width: 160,
      render: (_: unknown, r: QueueEncounter) => r.patient?.code ?? '—',
    },
    {
      title: 'Họ tên',
      key: 'fullName',
      render: (_: unknown, r: QueueEncounter) => r.patient?.fullName ?? '—',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: () => <Tag color="blue">Đang chờ</Tag>,
    },
    {
      title: '',
      key: 'action',
      width: 140,
      render: (_: unknown, r: QueueEncounter) => (
        <Button
          type="primary"
          onClick={() => {
            if (!r.patient) message.error(apiError(new Error('Thiếu thông tin người bệnh')));
            nav(`/encounters/${r.id}`);
          }}
        >
          Vào khám
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Typography.Title level={4}>Hàng chờ khám</Typography.Title>
      <Card>
        <Table
          rowKey="id"
          loading={isLoading}
          columns={columns}
          dataSource={data}
          pagination={false}
        />
      </Card>
    </div>
  );
}

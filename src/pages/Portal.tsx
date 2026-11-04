import { Card, Col, Row, Typography, Spin, Alert, Tag, Table, Button, Modal, Form, DatePicker, App, Descriptions } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, apiError } from '../api/client';

const INV_COLOR: Record<string, string> = { DRAFT: 'default', ISSUED: 'blue', PAID: 'green', PARTIAL: 'orange' };

export function PortalPage() {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const me = useQuery({ queryKey: ['portal-me'], queryFn: async () => (await api.get('/portal/me')).data.data });
  const appts = useQuery({ queryKey: ['portal-appts'], queryFn: async () => (await api.get('/portal/appointments')).data.data });
  const encs = useQuery({ queryKey: ['portal-encs'], queryFn: async () => (await api.get('/portal/encounters')).data.data });
  const invs = useQuery({ queryKey: ['portal-invs'], queryFn: async () => (await api.get('/portal/invoices')).data.data });

  const book = useMutation({
    mutationFn: async (v: any) => (await api.post('/portal/appointments', { scheduledAt: v.scheduledAt.toISOString() })).data,
    onSuccess: () => { message.success('Đã đặt lịch hẹn'); setOpen(false); form.resetFields(); qc.invalidateQueries({ queryKey: ['portal-appts'] }); },
    onError: (e) => message.error(apiError(e)),
  });

  if (me.isLoading) return <Spin />;
  if (me.error) return <Alert type="warning" message="Tài khoản chưa liên kết hồ sơ người bệnh hoặc không có quyền." />;

  const p = me.data;
  return (
    <div>
      <Typography.Title level={4}>Cổng người bệnh</Typography.Title>
      <Card style={{ marginBottom: 16 }}>
        <Descriptions title="Hồ sơ của tôi" column={2} size="small">
          <Descriptions.Item label="Mã người bệnh">{p.code}</Descriptions.Item>
          <Descriptions.Item label="Họ tên">{p.fullName}</Descriptions.Item>
          <Descriptions.Item label="Giới tính">{p.gender || '—'}</Descriptions.Item>
          <Descriptions.Item label="Điện thoại">{p.phone || '—'}</Descriptions.Item>
          <Descriptions.Item label="Số thẻ BHYT">{p.bhytCardNo || '—'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card
            title="Lịch hẹn"
            style={{ marginBottom: 16 }}
            extra={<Button type="primary" size="small" onClick={() => setOpen(true)}>Đặt lịch</Button>}
          >
            {appts.isLoading ? <Spin /> : (
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={appts.data || []}
                locale={{ emptyText: 'Chưa có lịch hẹn' }}
                columns={[
                  { title: 'Thời gian', dataIndex: 'scheduledAt', render: (v: string) => new Date(v).toLocaleString('vi-VN') },
                  { title: 'Kênh', dataIndex: 'channel' },
                  { title: 'Trạng thái', dataIndex: 'status', render: (s: string) => <Tag color="blue">{s}</Tag> },
                ]}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Hóa đơn" style={{ marginBottom: 16 }}>
            {invs.isLoading ? <Spin /> : (
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={invs.data || []}
                locale={{ emptyText: 'Chưa có hóa đơn' }}
                columns={[
                  { title: 'Tổng', dataIndex: 'total', render: (v: number) => v.toLocaleString('vi-VN') + ' đ' },
                  { title: 'BHYT trả', dataIndex: 'bhytPart', render: (v: number) => v.toLocaleString('vi-VN') + ' đ' },
                  { title: 'Phải trả', dataIndex: 'patientPart', render: (v: number) => v.toLocaleString('vi-VN') + ' đ' },
                  { title: 'Trạng thái', dataIndex: 'status', render: (s: string) => <Tag color={INV_COLOR[s]}>{s}</Tag> },
                ]}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Card title="Lịch sử khám & kết quả">
        {encs.isLoading ? <Spin /> : (
          <Table
            rowKey="id"
            size="small"
            dataSource={encs.data || []}
            locale={{ emptyText: 'Chưa có lượt khám' }}
            columns={[
              { title: 'Ngày', dataIndex: 'createdAt', render: (v: string) => new Date(v).toLocaleDateString('vi-VN') },
              { title: 'Loại', dataIndex: 'type', render: (t: string) => (t === 'INPATIENT' ? 'Nội trú' : 'Ngoại trú') },
              { title: 'Trạng thái', dataIndex: 'status', render: (s: string) => <Tag>{s}</Tag> },
              { title: 'Chẩn đoán', dataIndex: 'diagnoses', render: (d: any[]) => (d?.length ? d.map((x) => x.icd10Code).join(', ') : '—') },
              { title: 'Số đơn thuốc', dataIndex: 'prescriptions', render: (r: any[]) => r?.length || 0 },
            ]}
          />
        )}
      </Card>

      <Modal title="Đặt lịch hẹn trực tuyến" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} okText="Đặt lịch" confirmLoading={book.isPending}>
        <Form form={form} layout="vertical" onFinish={(v) => book.mutate(v)}>
          <Form.Item name="scheduledAt" label="Thời gian mong muốn" rules={[{ required: true, message: 'Chọn thời gian' }]}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

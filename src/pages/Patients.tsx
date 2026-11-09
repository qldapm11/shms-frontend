import { useState } from 'react';
import { Button, Card, Form, Input, Modal, Table, Typography, Space, DatePicker, Select, App } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Dayjs } from 'dayjs';
import { api, apiError } from '../api/client';

interface Patient {
  id: string;
  code: string;
  fullName: string;
  gender?: string | null;
  phone?: string | null;
  cccd?: string | null;
  dob?: string | null;
}

const GENDER_LABEL: Record<string, string> = { MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác' };

export function PatientsPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['patients', q],
    queryFn: async () => (await api.get('/patients', { params: q ? { q } : {} })).data.data as Patient[],
  });

  const create = useMutation({
    mutationFn: async (values: {
      fullName: string;
      gender?: string;
      dob?: Dayjs;
      phone?: string;
      cccd?: string;
    }) => {
      const body = {
        fullName: values.fullName,
        gender: values.gender,
        dob: values.dob ? values.dob.toISOString() : undefined,
        phone: values.phone,
        cccd: values.cccd,
      };
      return (await api.post('/patients', body)).data.data as Patient;
    },
    onSuccess: () => {
      message.success('Đã thêm người bệnh');
      setOpen(false);
      form.resetFields();
      qc.invalidateQueries({ queryKey: ['patients'] });
    },
    onError: (e) => message.error(apiError(e)),
  });

  const columns = [
    { title: 'Mã', dataIndex: 'code', key: 'code', width: 160 },
    { title: 'Họ tên', dataIndex: 'fullName', key: 'fullName' },
    {
      title: 'Giới tính',
      dataIndex: 'gender',
      key: 'gender',
      width: 120,
      render: (g?: string) => (g ? GENDER_LABEL[g] ?? g : '—'),
    },
    { title: 'Điện thoại', dataIndex: 'phone', key: 'phone', width: 160, render: (v?: string) => v || '—' },
  ];

  return (
    <div>
      <Typography.Title level={4}>Người bệnh</Typography.Title>
      <Card>
        <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
          <Input.Search
            placeholder="Tìm theo tên, mã, điện thoại, CCCD"
            allowClear
            onSearch={setQ}
            style={{ width: 360 }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
            Thêm người bệnh
          </Button>
        </Space>
        <Table
          rowKey="id"
          loading={isLoading}
          columns={columns}
          dataSource={data}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Modal
        title="Thêm người bệnh"
        open={open}
        onOk={() => form.submit()}
        onCancel={() => setOpen(false)}
        confirmLoading={create.isPending}
        okText="Lưu"
        cancelText="Hủy"
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(v) => create.mutate(v)}>
          <Form.Item name="fullName" label="Họ tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
            <Input placeholder="Nguyễn Văn A" />
          </Form.Item>
          <Form.Item name="gender" label="Giới tính">
            <Select
              allowClear
              placeholder="Chọn giới tính"
              options={[
                { value: 'MALE', label: 'Nam' },
                { value: 'FEMALE', label: 'Nữ' },
                { value: 'OTHER', label: 'Khác' },
              ]}
            />
          </Form.Item>
          <Form.Item name="dob" label="Ngày sinh">
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="Chọn ngày sinh" />
          </Form.Item>
          <Form.Item name="phone" label="Điện thoại">
            <Input placeholder="09xxxxxxxx" />
          </Form.Item>
          <Form.Item name="cccd" label="CCCD">
            <Input placeholder="Số căn cước công dân" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

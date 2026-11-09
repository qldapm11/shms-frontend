import { useState } from 'react';
import {
  Tabs, Table, Button, Tag, Typography, Spin, Alert, Space, Modal, Form, Input, Select,
  InputNumber, App, Popconfirm,
} from 'antd';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { api, apiError } from '../api/client';

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'green', INACTIVE: 'default', EMPTY: 'green', RESERVED: 'gold',
  OCCUPIED: 'blue', MAINT: 'red',
};

function is403(err: unknown): boolean {
  return axios.isAxiosError(err) && err.response?.status === 403;
}

function Forbidden() {
  return <Alert type="warning" showIcon message="Không đủ quyền" description="Bạn không có quyền quản trị danh mục." />;
}

interface Department { id: string; code: string; name: string; type: string; status: string; }
interface Bed { id: string; code: string; departmentId: string; status: string; department?: { code: string; name: string }; }
interface Service { id: string; code: string; name: string; specialty: string | null; price: number; bhytPrice: number; status: string; }
interface Drug { id: string; code: string; name: string; unit: string; form: string | null; activeIngredient: string | null; status: string; }
interface Icd10 { code: string; name: string; parent: string | null; status?: string; }

// ---------------- Departments ----------------
function DepartmentsTab() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form] = Form.useForm();

  const q = useQuery({
    queryKey: ['catalog', 'departments'],
    queryFn: async () => (await api.get('/admin/departments')).data.data as Department[],
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['catalog', 'departments'] });

  const save = useMutation({
    mutationFn: async (v: Record<string, unknown>) =>
      editing
        ? (await api.patch(`/admin/departments/${editing.id}`, v)).data
        : (await api.post('/admin/departments', v)).data,
    onSuccess: () => { message.success('Đã lưu khoa/phòng'); setOpen(false); form.resetFields(); invalidate(); },
    onError: (e) => message.error(apiError(e)),
  });
  const deactivate = useMutation({
    mutationFn: async (id: string) => (await api.post(`/admin/departments/${id}/deactivate`)).data,
    onSuccess: () => { message.success('Đã ngừng hoạt động'); invalidate(); },
    onError: (e) => message.error(apiError(e)),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/admin/departments/${id}`)).data,
    onSuccess: () => { message.success('Đã xóa khoa/phòng'); invalidate(); },
    onError: (e) => message.error(apiError(e)),
  });

  if (is403(q.error)) return <Forbidden />;
  if (q.isLoading) return <Spin />;
  if (q.error) return <Alert type="error" message="Không tải được danh sách khoa/phòng" />;

  const openAdd = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ type: 'KHOA' }); setOpen(true); };
  const openEdit = (d: Department) => { setEditing(d); form.setFieldsValue(d); setOpen(true); };

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'flex-end' }}>
        <Button type="primary" onClick={openAdd}>Thêm khoa/phòng</Button>
      </Space>
      <Table
        rowKey="id"
        dataSource={q.data ?? []}
        columns={[
          { title: 'Mã', dataIndex: 'code' },
          { title: 'Tên', dataIndex: 'name' },
          { title: 'Loại', dataIndex: 'type' },
          { title: 'Trạng thái', dataIndex: 'status', render: (s: string) => <Tag color={STATUS_COLOR[s] ?? 'default'}>{s}</Tag> },
          {
            title: 'Thao tác',
            render: (_, d: Department) => (
              <Space>
                <Button size="small" onClick={() => openEdit(d)}>Sửa</Button>
                <Button size="small" danger disabled={d.status === 'INACTIVE'} onClick={() => deactivate.mutate(d.id)}>Ngừng</Button>
                <Popconfirm title="Xóa khoa/phòng?" description="Chỉ xóa được khi chưa có dữ liệu liên quan." okText="Xóa" cancelText="Hủy" okButtonProps={{ danger: true }} onConfirm={() => remove.mutate(d.id)}>
                  <Button size="small" danger>Xóa</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title={editing ? 'Sửa khoa/phòng' : 'Thêm khoa/phòng'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
          {!editing && (
            <Form.Item name="code" label="Mã" rules={[{ required: true, message: 'Nhập mã' }]}>
              <Input />
            </Form.Item>
          )}
          <Form.Item name="name" label="Tên" rules={[{ required: true, message: 'Nhập tên' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="Loại" rules={[{ required: true }]}>
            <Select options={[
              { value: 'KHOA', label: 'Khoa' },
              { value: 'PHONG', label: 'Phòng' },
              { value: 'BUONG', label: 'Buồng' },
            ]} />
          </Form.Item>
          {editing && (
            <Form.Item name="status" label="Trạng thái">
              <Select options={[{ value: 'ACTIVE', label: 'ACTIVE' }, { value: 'INACTIVE', label: 'INACTIVE' }]} />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}

// ---------------- Beds ----------------
function BedsTab() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Bed | null>(null);
  const [form] = Form.useForm();

  const q = useQuery({
    queryKey: ['catalog', 'beds'],
    queryFn: async () => (await api.get('/admin/beds')).data.data as Bed[],
  });
  const deps = useQuery({
    queryKey: ['catalog', 'departments'],
    queryFn: async () => (await api.get('/admin/departments')).data.data as Department[],
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['catalog', 'beds'] });

  const save = useMutation({
    mutationFn: async (v: Record<string, unknown>) =>
      editing
        ? (await api.patch(`/admin/beds/${editing.id}`, v)).data
        : (await api.post('/admin/beds', v)).data,
    onSuccess: () => { message.success('Đã lưu giường'); setOpen(false); form.resetFields(); invalidate(); },
    onError: (e) => message.error(apiError(e)),
  });
  const deactivate = useMutation({
    mutationFn: async (id: string) => (await api.post(`/admin/beds/${id}/deactivate`)).data,
    onSuccess: () => { message.success('Đã chuyển bảo trì'); invalidate(); },
    onError: (e) => message.error(apiError(e)),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/admin/beds/${id}`)).data,
    onSuccess: () => { message.success('Đã xóa giường'); invalidate(); },
    onError: (e) => message.error(apiError(e)),
  });

  if (is403(q.error)) return <Forbidden />;
  if (q.isLoading) return <Spin />;
  if (q.error) return <Alert type="error" message="Không tải được danh sách giường" />;

  const openAdd = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ status: 'EMPTY' }); setOpen(true); };
  const openEdit = (b: Bed) => { setEditing(b); form.setFieldsValue(b); setOpen(true); };
  const depOptions = (deps.data ?? []).map((d) => ({ value: d.id, label: `${d.name} (${d.code})` }));

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'flex-end' }}>
        <Button type="primary" onClick={openAdd}>Thêm giường</Button>
      </Space>
      <Table
        rowKey="id"
        dataSource={q.data ?? []}
        columns={[
          { title: 'Mã', dataIndex: 'code' },
          { title: 'Khoa/phòng', render: (_, b: Bed) => b.department ? `${b.department.name} (${b.department.code})` : b.departmentId },
          { title: 'Trạng thái', dataIndex: 'status', render: (s: string) => <Tag color={STATUS_COLOR[s] ?? 'default'}>{s}</Tag> },
          {
            title: 'Thao tác',
            render: (_, b: Bed) => (
              <Space>
                <Button size="small" onClick={() => openEdit(b)}>Sửa</Button>
                <Button size="small" danger disabled={b.status === 'MAINT'} onClick={() => deactivate.mutate(b.id)}>Ngừng</Button>
                <Popconfirm title="Xóa giường?" description="Chỉ xóa được khi chưa từng có người nằm." okText="Xóa" cancelText="Hủy" okButtonProps={{ danger: true }} onConfirm={() => remove.mutate(b.id)}>
                  <Button size="small" danger>Xóa</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title={editing ? 'Sửa giường' : 'Thêm giường'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
          {!editing && (
            <Form.Item name="code" label="Mã" rules={[{ required: true, message: 'Nhập mã' }]}>
              <Input />
            </Form.Item>
          )}
          <Form.Item name="departmentId" label="Khoa/phòng" rules={[{ required: true, message: 'Chọn khoa/phòng' }]}>
            <Select loading={deps.isLoading} options={depOptions} showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="status" label="Trạng thái">
            <Select options={[
              { value: 'EMPTY', label: 'Trống' },
              { value: 'RESERVED', label: 'Đã đặt' },
              { value: 'OCCUPIED', label: 'Đang dùng' },
              { value: 'MAINT', label: 'Bảo trì' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ---------------- Services ----------------
function ServicesTab() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form] = Form.useForm();

  const q = useQuery({
    queryKey: ['catalog', 'services'],
    queryFn: async () => (await api.get('/admin/services')).data.data as Service[],
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['catalog', 'services'] });

  const save = useMutation({
    mutationFn: async (v: Record<string, unknown>) =>
      editing
        ? (await api.patch(`/admin/services/${editing.id}`, v)).data
        : (await api.post('/admin/services', v)).data,
    onSuccess: () => { message.success('Đã lưu dịch vụ'); setOpen(false); form.resetFields(); invalidate(); },
    onError: (e) => message.error(apiError(e)),
  });
  const deactivate = useMutation({
    mutationFn: async (id: string) => (await api.post(`/admin/services/${id}/deactivate`)).data,
    onSuccess: () => { message.success('Đã ngừng dịch vụ'); invalidate(); },
    onError: (e) => message.error(apiError(e)),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/admin/services/${id}`)).data,
    onSuccess: () => { message.success('Đã xóa dịch vụ'); invalidate(); },
    onError: (e) => message.error(apiError(e)),
  });

  if (is403(q.error)) return <Forbidden />;
  if (q.isLoading) return <Spin />;
  if (q.error) return <Alert type="error" message="Không tải được danh sách dịch vụ" />;

  const openAdd = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ price: 0, bhytPrice: 0 }); setOpen(true); };
  const openEdit = (s: Service) => { setEditing(s); form.setFieldsValue(s); setOpen(true); };

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'flex-end' }}>
        <Button type="primary" onClick={openAdd}>Thêm dịch vụ</Button>
      </Space>
      <Table
        rowKey="id"
        dataSource={q.data ?? []}
        columns={[
          { title: 'Mã', dataIndex: 'code' },
          { title: 'Tên', dataIndex: 'name' },
          { title: 'Chuyên khoa', dataIndex: 'specialty' },
          { title: 'Giá', dataIndex: 'price', align: 'right', render: (v: number) => (v ?? 0).toLocaleString('vi-VN') },
          { title: 'Giá BHYT', dataIndex: 'bhytPrice', align: 'right', render: (v: number) => (v ?? 0).toLocaleString('vi-VN') },
          { title: 'Trạng thái', dataIndex: 'status', render: (s: string) => <Tag color={STATUS_COLOR[s] ?? 'default'}>{s}</Tag> },
          {
            title: 'Thao tác',
            render: (_, s: Service) => (
              <Space>
                <Button size="small" onClick={() => openEdit(s)}>Sửa</Button>
                <Button size="small" danger disabled={s.status === 'INACTIVE'} onClick={() => deactivate.mutate(s.id)}>Ngừng</Button>
                <Popconfirm title="Xóa dịch vụ?" description="Chỉ xóa được khi chưa phát sinh chỉ định/hóa đơn." okText="Xóa" cancelText="Hủy" okButtonProps={{ danger: true }} onConfirm={() => remove.mutate(s.id)}>
                  <Button size="small" danger>Xóa</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title={editing ? 'Sửa dịch vụ' : 'Thêm dịch vụ'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
          {!editing && (
            <Form.Item name="code" label="Mã" rules={[{ required: true, message: 'Nhập mã' }]}>
              <Input />
            </Form.Item>
          )}
          <Form.Item name="name" label="Tên" rules={[{ required: true, message: 'Nhập tên' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="specialty" label="Chuyên khoa">
            <Input />
          </Form.Item>
          <Form.Item name="price" label="Giá (đ)" rules={[{ required: true, message: 'Nhập giá' }]}>
            <InputNumber min={0} style={{ width: '100%' }} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
          </Form.Item>
          <Form.Item name="bhytPrice" label="Giá BHYT (đ)">
            <InputNumber min={0} style={{ width: '100%' }} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
          </Form.Item>
          {editing && (
            <Form.Item name="status" label="Trạng thái">
              <Select options={[{ value: 'ACTIVE', label: 'ACTIVE' }, { value: 'INACTIVE', label: 'INACTIVE' }]} />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}

// ---------------- Drugs ----------------
function DrugsTab() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Drug | null>(null);
  const [form] = Form.useForm();

  const q = useQuery({
    queryKey: ['catalog', 'drugs'],
    queryFn: async () => (await api.get('/admin/drugs')).data.data as Drug[],
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['catalog', 'drugs'] });

  const save = useMutation({
    mutationFn: async (v: Record<string, unknown>) =>
      editing
        ? (await api.patch(`/admin/drugs/${editing.id}`, v)).data
        : (await api.post('/admin/drugs', v)).data,
    onSuccess: () => { message.success('Đã lưu thuốc'); setOpen(false); form.resetFields(); invalidate(); },
    onError: (e) => message.error(apiError(e)),
  });
  const deactivate = useMutation({
    mutationFn: async (id: string) => (await api.post(`/admin/drugs/${id}/deactivate`)).data,
    onSuccess: () => { message.success('Đã ngừng thuốc'); invalidate(); },
    onError: (e) => message.error(apiError(e)),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/admin/drugs/${id}`)).data,
    onSuccess: () => { message.success('Đã xóa thuốc'); invalidate(); },
    onError: (e) => message.error(apiError(e)),
  });

  if (is403(q.error)) return <Forbidden />;
  if (q.isLoading) return <Spin />;
  if (q.error) return <Alert type="error" message="Không tải được danh sách thuốc" />;

  const openAdd = () => { setEditing(null); form.resetFields(); setOpen(true); };
  const openEdit = (d: Drug) => { setEditing(d); form.setFieldsValue(d); setOpen(true); };

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'flex-end' }}>
        <Button type="primary" onClick={openAdd}>Thêm thuốc</Button>
      </Space>
      <Table
        rowKey="id"
        dataSource={q.data ?? []}
        columns={[
          { title: 'Mã', dataIndex: 'code' },
          { title: 'Tên', dataIndex: 'name' },
          { title: 'Đơn vị', dataIndex: 'unit' },
          { title: 'Dạng', dataIndex: 'form' },
          { title: 'Hoạt chất', dataIndex: 'activeIngredient' },
          { title: 'Trạng thái', dataIndex: 'status', render: (s: string) => <Tag color={STATUS_COLOR[s] ?? 'default'}>{s}</Tag> },
          {
            title: 'Thao tác',
            render: (_, d: Drug) => (
              <Space>
                <Button size="small" onClick={() => openEdit(d)}>Sửa</Button>
                <Button size="small" danger disabled={d.status === 'INACTIVE'} onClick={() => deactivate.mutate(d.id)}>Ngừng</Button>
                <Popconfirm title="Xóa thuốc?" description="Chỉ xóa được khi chưa phát sinh đơn/tồn kho/hóa đơn." okText="Xóa" cancelText="Hủy" okButtonProps={{ danger: true }} onConfirm={() => remove.mutate(d.id)}>
                  <Button size="small" danger>Xóa</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title={editing ? 'Sửa thuốc' : 'Thêm thuốc'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
          {!editing && (
            <Form.Item name="code" label="Mã" rules={[{ required: true, message: 'Nhập mã' }]}>
              <Input />
            </Form.Item>
          )}
          <Form.Item name="name" label="Tên" rules={[{ required: true, message: 'Nhập tên' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="unit" label="Đơn vị" rules={[{ required: true, message: 'Nhập đơn vị' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="form" label="Dạng bào chế">
            <Input />
          </Form.Item>
          <Form.Item name="activeIngredient" label="Hoạt chất">
            <Input />
          </Form.Item>
          {editing && (
            <Form.Item name="status" label="Trạng thái">
              <Select options={[{ value: 'ACTIVE', label: 'ACTIVE' }, { value: 'INACTIVE', label: 'INACTIVE' }]} />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}

// ---------------- ICD-10 ----------------
function Icd10Tab() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Icd10 | null>(null);
  const [search, setSearch] = useState('');
  const [form] = Form.useForm();

  const q: UseQueryResult<Icd10[]> = useQuery({
    queryKey: ['catalog', 'icd10', search],
    queryFn: async () => (await api.get('/admin/icd10', { params: search ? { q: search } : {} })).data.data as Icd10[],
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['catalog', 'icd10'] });

  const save = useMutation({
    mutationFn: async (v: Record<string, unknown>) =>
      editing
        ? (await api.patch(`/admin/icd10/${encodeURIComponent(editing.code)}`, v)).data
        : (await api.post('/admin/icd10', v)).data,
    onSuccess: () => { message.success('Đã lưu ICD-10'); setOpen(false); form.resetFields(); invalidate(); },
    onError: (e) => message.error(apiError(e)),
  });
  const toggle = useMutation({
    mutationFn: async (i: Icd10) =>
      (await api.post(`/admin/icd10/${encodeURIComponent(i.code)}/${i.status === 'INACTIVE' ? 'activate' : 'deactivate'}`)).data,
    onSuccess: () => { message.success('Đã cập nhật trạng thái'); invalidate(); },
    onError: (e) => message.error(apiError(e)),
  });
  const remove = useMutation({
    mutationFn: async (code: string) => (await api.delete(`/admin/icd10/${encodeURIComponent(code)}`)).data,
    onSuccess: () => { message.success('Đã xóa ICD-10'); invalidate(); },
    onError: (e) => message.error(apiError(e)),
  });

  if (is403(q.error)) return <Forbidden />;

  const openAdd = () => { setEditing(null); form.resetFields(); setOpen(true); };
  const openEdit = (i: Icd10) => { setEditing(i); form.setFieldsValue(i); setOpen(true); };

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Input.Search placeholder="Tìm mã hoặc tên" allowClear style={{ maxWidth: 320 }} onSearch={setSearch} />
        <Button type="primary" onClick={openAdd}>Thêm ICD-10</Button>
      </Space>
      {q.error && !is403(q.error) ? (
        <Alert type="error" message="Không tải được danh mục ICD-10" />
      ) : (
        <Table
          rowKey="code"
          loading={q.isLoading}
          dataSource={q.data ?? []}
          columns={[
            { title: 'Mã', dataIndex: 'code', width: 120 },
            { title: 'Tên', dataIndex: 'name' },
            { title: 'Mã cha', dataIndex: 'parent' },
            { title: 'Trạng thái', dataIndex: 'status', width: 110, render: (s: string) => <Tag color={STATUS_COLOR[s] ?? 'green'}>{s ?? 'ACTIVE'}</Tag> },
            {
              title: 'Thao tác',
              render: (_, i: Icd10) => (
                <Space>
                  <Button size="small" onClick={() => openEdit(i)}>Sửa</Button>
                  <Button size="small" danger={i.status !== 'INACTIVE'} onClick={() => toggle.mutate(i)}>
                    {i.status === 'INACTIVE' ? 'Kích hoạt' : 'Ngừng'}
                  </Button>
                  <Popconfirm title="Xóa mã ICD-10?" description="Chỉ xóa được khi chưa dùng trong chẩn đoán." okText="Xóa" cancelText="Hủy" okButtonProps={{ danger: true }} onConfirm={() => remove.mutate(i.code)}>
                    <Button size="small" danger>Xóa</Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      )}
      <Modal
        title={editing ? 'Sửa ICD-10' : 'Thêm ICD-10'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
          {!editing && (
            <Form.Item name="code" label="Mã" rules={[{ required: true, message: 'Nhập mã' }]}>
              <Input />
            </Form.Item>
          )}
          <Form.Item name="name" label="Tên" rules={[{ required: true, message: 'Nhập tên' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="parent" label="Mã cha">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export function CatalogPage() {
  return (
    <div>
      <Typography.Title level={4}>Danh mục</Typography.Title>
      <Tabs
        items={[
          { key: 'departments', label: 'Khoa/phòng', children: <DepartmentsTab /> },
          { key: 'beds', label: 'Giường', children: <BedsTab /> },
          { key: 'services', label: 'Dịch vụ', children: <ServicesTab /> },
          { key: 'drugs', label: 'Thuốc', children: <DrugsTab /> },
          { key: 'icd10', label: 'ICD-10', children: <Icd10Tab /> },
        ]}
      />
    </div>
  );
}

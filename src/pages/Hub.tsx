import { useState } from 'react';
import {
  Tabs, Table, Button, Tag, Typography, Spin, Alert, Space, Modal, Form, Input, Select, App, Descriptions, Timeline,
} from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { api, apiError } from '../api/client';
import { useAuth } from '../store/auth';

interface HubDoc { id: string; path: string; title: string; category: string | null; currentVersion: number }
interface HubDocVersion { id: string; version: number; content: string; authorId: string; createdAt: string }
interface HubReview { id: string; version: number; reviewerId: string; status: string; comment: string | null; createdAt: string }
interface HubTask { id: string; code: string; title: string; type: string; status: string; ownerId: string | null; reviewerId: string | null; description: string | null; updatedAt: string }
interface HubDecision { id: string; title: string; decision: string; authority: string | null; reason: string | null; decidedAt: string }
interface HubEvent { id: string; actor: string; type: string; detail: string | null; createdAt: string }
interface HubTestCase { id: string; featureId: string; steps: string | null; expected: string | null; result: string; evidence: string | null }
interface TraceRow { id: string; code: string; title: string; type: string; status: string; ownerId: string | null; reviewerId: string | null; featureIds: string[]; screenIds: string[]; dependencyIds: string[] }

const TASK_STATUSES = ['DRAFT', 'READY', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'CHANGES_REQUESTED', 'DONE', 'CANCELLED'];
const TASK_COLOR: Record<string, string> = {
  DRAFT: 'default', READY: 'blue', IN_PROGRESS: 'processing', BLOCKED: 'red',
  IN_REVIEW: 'gold', CHANGES_REQUESTED: 'orange', DONE: 'green', CANCELLED: 'default',
};
const RESULT_COLOR: Record<string, string> = { PASS: 'green', FAIL: 'red', NOT_RUN: 'default' };

function Forbidden() {
  return <Alert type="warning" showIcon message="Không đủ quyền" description="Bạn không có quyền xem mục này." />;
}
function is403(e: unknown) {
  return axios.isAxiosError(e) && e.response?.status === 403;
}

// ============ DA02/DA03 — Tài liệu + review + so sánh version ============
function DocumentsTab() {
  const { message } = App.useApp();
  const { can } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();

  const docs = useQuery({
    queryKey: ['hub-docs', q],
    queryFn: async () => (await api.get('/hub/documents', { params: { q: q || undefined } })).data.documents as HubDoc[],
    retry: false,
  });

  const create = useMutation({
    mutationFn: async (vars: any) => (await api.post('/hub/documents', vars)).data,
    onSuccess: () => {
      message.success('Đã tạo tài liệu');
      setCreateOpen(false);
      form.resetFields();
      qc.invalidateQueries({ queryKey: ['hub-docs'] });
    },
    onError: (e) => message.error(apiError(e)),
  });

  if (is403(docs.error)) return <Forbidden />;
  if (docs.isLoading) return <Spin />;
  if (docs.error) return <Alert type="error" message="Không tải được tài liệu" />;

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Input.Search placeholder="Tìm theo tiêu đề/đường dẫn" allowClear onSearch={setQ} style={{ width: 320 }} />
        {can('hub.write') && <Button type="primary" onClick={() => setCreateOpen(true)}>Tạo tài liệu</Button>}
      </Space>
      <Table<HubDoc>
        rowKey="id"
        dataSource={docs.data ?? []}
        columns={[
          { title: 'Đường dẫn', dataIndex: 'path' },
          { title: 'Tiêu đề', dataIndex: 'title' },
          { title: 'Phân loại', dataIndex: 'category', render: (c: string | null) => c ? <Tag>{c}</Tag> : '—' },
          { title: 'Version', dataIndex: 'currentVersion', width: 90 },
          { title: 'Thao tác', width: 110, render: (_: unknown, d: HubDoc) => <Button size="small" onClick={() => setSelected(d.id)}>Chi tiết</Button> },
        ]}
      />

      <Modal title="Tạo tài liệu" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => form.submit()} confirmLoading={create.isPending} okText="Lưu" cancelText="Hủy">
        <Form form={form} layout="vertical" onFinish={(v) => create.mutate(v)}>
          <Form.Item name="path" label="Đường dẫn" rules={[{ required: true, message: 'Nhập đường dẫn' }]}><Input placeholder="vd: thiet-ke/kien-truc.md" /></Form.Item>
          <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, message: 'Nhập tiêu đề' }]}><Input /></Form.Item>
          <Form.Item name="category" label="Phân loại"><Input placeholder="Tùy chọn" /></Form.Item>
          <Form.Item name="content" label="Nội dung"><Input.TextArea rows={6} /></Form.Item>
        </Form>
      </Modal>

      {selected && <DocDetailModal docId={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function DocDetailModal({ docId, onClose }: { docId: string; onClose: () => void }) {
  const { message } = App.useApp();
  const { can } = useAuth();
  const qc = useQueryClient();
  const [verOpen, setVerOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [diff, setDiff] = useState<{ from: number; to: number } | null>(null);
  const [verForm] = Form.useForm();
  const [reviewForm] = Form.useForm();

  const doc = useQuery({
    queryKey: ['hub-doc', docId],
    queryFn: async () => (await api.get(`/hub/documents/${docId}`)).data.document as HubDoc & { versions: HubDocVersion[] },
    retry: false,
  });
  const reviews = useQuery({
    queryKey: ['hub-doc-reviews', docId],
    queryFn: async () => (await api.get(`/hub/documents/${docId}/reviews`)).data.reviews as HubReview[],
    retry: false,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['hub-doc', docId] });
    qc.invalidateQueries({ queryKey: ['hub-docs'] });
  };

  const addVersion = useMutation({
    mutationFn: async (vars: any) => (await api.post(`/hub/documents/${docId}/versions`, vars)).data,
    onSuccess: () => { message.success('Đã thêm version'); setVerOpen(false); verForm.resetFields(); invalidate(); },
    onError: (e) => message.error(apiError(e)),
  });
  const addReview = useMutation({
    mutationFn: async (vars: any) => (await api.post(`/hub/documents/${docId}/reviews`, vars)).data,
    onSuccess: () => { message.success('Đã ghi review'); setReviewOpen(false); reviewForm.resetFields(); qc.invalidateQueries({ queryKey: ['hub-doc-reviews', docId] }); },
    onError: (e) => message.error(apiError(e)),
  });

  const versions = doc.data?.versions ?? [];

  return (
    <Modal title={doc.data ? `${doc.data.title} (v${doc.data.currentVersion})` : 'Tài liệu'} open width={760} onCancel={onClose} footer={<Button onClick={onClose}>Đóng</Button>}>
      {doc.isLoading ? <Spin /> : doc.error ? <Alert type="error" message="Không tải được tài liệu" /> : (
        <div>
          <Space style={{ marginBottom: 12 }} wrap>
            {can('hub.write') && <Button size="small" type="primary" onClick={() => { verForm.setFieldsValue({ content: versions[versions.length - 1]?.content ?? '' }); setVerOpen(true); }}>Thêm version</Button>}
            {can('hub.review') && <Button size="small" onClick={() => setReviewOpen(true)}>Review</Button>}
            {versions.length >= 2 && <Button size="small" onClick={() => setDiff({ from: versions[versions.length - 2].version, to: versions[versions.length - 1].version })}>So sánh 2 version mới nhất</Button>}
          </Space>

          <Typography.Title level={5}>Nội dung hiện tại</Typography.Title>
          <pre style={{ background: '#fafafa', padding: 12, borderRadius: 6, maxHeight: 220, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{versions[versions.length - 1]?.content || '(trống)'}</pre>

          <Typography.Title level={5} style={{ marginTop: 16 }}>Lịch sử review</Typography.Title>
          {reviews.isLoading ? <Spin /> : (reviews.data ?? []).length === 0 ? <Typography.Text type="secondary">Chưa có review</Typography.Text> : (
            <Timeline items={(reviews.data ?? []).map((r) => ({
              color: r.status === 'APPROVED' ? 'green' : 'orange',
              children: <span><Tag color={r.status === 'APPROVED' ? 'green' : 'orange'}>{r.status === 'APPROVED' ? 'Duyệt' : 'Yêu cầu sửa'}</Tag> v{r.version} — {r.comment || '(không ghi chú)'} · {new Date(r.createdAt).toLocaleString('vi-VN')}</span>,
            }))} />
          )}

          <Modal title="Thêm version" open={verOpen} onCancel={() => setVerOpen(false)} onOk={() => verForm.submit()} confirmLoading={addVersion.isPending} okText="Lưu" cancelText="Hủy">
            <Form form={verForm} layout="vertical" onFinish={(v) => addVersion.mutate(v)}>
              <Form.Item name="content" label="Nội dung version mới" rules={[{ required: true, message: 'Nhập nội dung' }]}><Input.TextArea rows={8} /></Form.Item>
            </Form>
          </Modal>

          <Modal title="Review tài liệu" open={reviewOpen} onCancel={() => setReviewOpen(false)} onOk={() => reviewForm.submit()} confirmLoading={addReview.isPending} okText="Gửi" cancelText="Hủy">
            <Form form={reviewForm} layout="vertical" initialValues={{ status: 'APPROVED' }} onFinish={(v) => addReview.mutate(v)}>
              <Form.Item name="status" label="Kết luận"><Select options={[{ value: 'APPROVED', label: 'Duyệt' }, { value: 'CHANGES', label: 'Yêu cầu sửa' }]} /></Form.Item>
              <Form.Item name="comment" label="Ghi chú"><Input.TextArea rows={3} /></Form.Item>
            </Form>
          </Modal>

          {diff && <DiffModal docId={docId} from={diff.from} to={diff.to} onClose={() => setDiff(null)} />}
        </div>
      )}
    </Modal>
  );
}

function DiffModal({ docId, from, to, onClose }: { docId: string; from: number; to: number; onClose: () => void }) {
  const diff = useQuery({
    queryKey: ['hub-diff', docId, from, to],
    queryFn: async () => (await api.get(`/hub/documents/${docId}/diff`, { params: { from, to } })).data,
    retry: false,
  });
  return (
    <Modal title={`So sánh v${from} → v${to}`} open width={820} onCancel={onClose} footer={<Button onClick={onClose}>Đóng</Button>}>
      {diff.isLoading ? <Spin /> : diff.error ? <Alert type="error" message="Không tải được so sánh" /> : (
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Typography.Text strong>v{diff.data.from.version}</Typography.Text>
            <pre style={{ background: '#fff1f0', padding: 10, borderRadius: 6, maxHeight: 360, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{diff.data.from.content}</pre>
          </div>
          <div style={{ flex: 1 }}>
            <Typography.Text strong>v{diff.data.to.version}</Typography.Text>
            <pre style={{ background: '#f6ffed', padding: 10, borderRadius: 6, maxHeight: 360, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{diff.data.to.content}</pre>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ============ DA04 — Task ============
function TasksTab() {
  const { message } = App.useApp();
  const { can } = useAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const tasks = useQuery({
    queryKey: ['hub-tasks', statusFilter],
    queryFn: async () => (await api.get('/hub/tasks', { params: { status: statusFilter } })).data.tasks as HubTask[],
    retry: false,
  });

  const create = useMutation({
    mutationFn: async (vars: any) => (await api.post('/hub/tasks', vars)).data,
    onSuccess: () => { message.success('Đã tạo task'); setOpen(false); form.resetFields(); qc.invalidateQueries({ queryKey: ['hub-tasks'] }); },
    onError: (e) => message.error(apiError(e)),
  });
  const patch = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => (await api.patch(`/hub/tasks/${id}`, { status })).data,
    onSuccess: () => { message.success('Đã cập nhật'); qc.invalidateQueries({ queryKey: ['hub-tasks'] }); },
    onError: (e) => message.error(apiError(e)),
  });

  if (is403(tasks.error)) return <Forbidden />;
  if (tasks.isLoading) return <Spin />;
  if (tasks.error) return <Alert type="error" message="Không tải được task" />;

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Select allowClear placeholder="Lọc trạng thái" style={{ width: 200 }} value={statusFilter} onChange={setStatusFilter} options={TASK_STATUSES.map((s) => ({ value: s, label: s }))} />
        {can('hub.write') && <Button type="primary" onClick={() => setOpen(true)}>Tạo task</Button>}
      </Space>
      <Table<HubTask>
        rowKey="id"
        dataSource={tasks.data ?? []}
        columns={[
          { title: 'Mã', dataIndex: 'code', width: 120 },
          { title: 'Tiêu đề', dataIndex: 'title' },
          { title: 'Loại', dataIndex: 'type', width: 110, render: (t: string) => <Tag>{t}</Tag> },
          { title: 'Trạng thái', dataIndex: 'status', width: 160, render: (s: string) => <Tag color={TASK_COLOR[s] ?? 'default'}>{s}</Tag> },
          {
            title: 'Chuyển trạng thái', width: 190,
            render: (_: unknown, t: HubTask) => can('hub.write') ? (
              <Select size="small" style={{ width: 170 }} value={t.status} onChange={(status) => patch.mutate({ id: t.id, status })} options={TASK_STATUSES.map((s) => ({ value: s, label: s }))} />
            ) : null,
          },
        ]}
      />

      <Modal title="Tạo task" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} confirmLoading={create.isPending} okText="Lưu" cancelText="Hủy">
        <Form form={form} layout="vertical" initialValues={{ type: 'FEATURE', status: 'DRAFT' }} onFinish={(v) => create.mutate(v)}>
          <Form.Item name="code" label="Mã task" rules={[{ required: true, message: 'Nhập mã' }]}><Input placeholder="vd: T-001" /></Form.Item>
          <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, message: 'Nhập tiêu đề' }]}><Input /></Form.Item>
          <Form.Item name="type" label="Loại"><Select options={['FEATURE', 'BUG', 'DOC', 'TEST', 'OPS'].map((v) => ({ value: v, label: v }))} /></Form.Item>
          <Form.Item name="status" label="Trạng thái"><Select options={TASK_STATUSES.map((s) => ({ value: s, label: s }))} /></Form.Item>
          <Form.Item name="description" label="Mô tả"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ============ DA05 — Ma trận truy vết ============
function TraceabilityTab() {
  const trace = useQuery({
    queryKey: ['hub-trace'],
    queryFn: async () => (await api.get('/hub/traceability')).data.traceability as TraceRow[],
    retry: false,
  });
  if (is403(trace.error)) return <Forbidden />;
  if (trace.isLoading) return <Spin />;
  if (trace.error) return <Alert type="error" message="Không tải được ma trận truy vết" />;
  return (
    <Table<TraceRow>
      rowKey="id"
      dataSource={trace.data ?? []}
      columns={[
        { title: 'Mã', dataIndex: 'code', width: 110 },
        { title: 'Task', dataIndex: 'title' },
        { title: 'Tính năng', dataIndex: 'featureIds', render: (ids: string[]) => ids.length ? ids.map((f) => <Tag key={f}>{f}</Tag>) : '—' },
        { title: 'Màn hình', dataIndex: 'screenIds', render: (ids: string[]) => ids.length ? ids.map((s) => <Tag key={s} color="blue">{s}</Tag>) : '—' },
        { title: 'Phụ thuộc', dataIndex: 'dependencyIds', render: (ids: string[]) => ids.length ? ids.join(', ') : '—' },
        { title: 'Trạng thái', dataIndex: 'status', width: 150, render: (s: string) => <Tag color={TASK_COLOR[s] ?? 'default'}>{s}</Tag> },
      ]}
    />
  );
}

// ============ DA06 — Context/sự kiện (handoff) ============
function EventsTab() {
  const { message } = App.useApp();
  const { can } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const events = useQuery({
    queryKey: ['hub-events'],
    queryFn: async () => (await api.get('/hub/events')).data.events as HubEvent[],
    retry: false,
  });
  const create = useMutation({
    mutationFn: async (vars: any) => (await api.post('/hub/events', vars)).data,
    onSuccess: () => { message.success('Đã ghi sự kiện'); setOpen(false); form.resetFields(); qc.invalidateQueries({ queryKey: ['hub-events'] }); },
    onError: (e) => message.error(apiError(e)),
  });

  if (is403(events.error)) return <Forbidden />;
  if (events.isLoading) return <Spin />;
  if (events.error) return <Alert type="error" message="Không tải được sự kiện" />;

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'flex-end' }}>
        {can('hub.write') && <Button type="primary" onClick={() => setOpen(true)}>Ghi context/handoff</Button>}
      </Space>
      <Timeline items={(events.data ?? []).map((e) => ({
        children: <span><Tag>{e.type}</Tag> {e.detail || ''} <Typography.Text type="secondary">— {e.actor} · {new Date(e.createdAt).toLocaleString('vi-VN')}</Typography.Text></span>,
      }))} />
      {(events.data ?? []).length === 0 && <Typography.Text type="secondary">Chưa có sự kiện</Typography.Text>}

      <Modal title="Ghi context/handoff" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} confirmLoading={create.isPending} okText="Lưu" cancelText="Hủy">
        <Form form={form} layout="vertical" initialValues={{ type: 'HANDOFF' }} onFinish={(v) => create.mutate(v)}>
          <Form.Item name="type" label="Loại"><Select options={['HANDOFF', 'CHECKPOINT', 'CONTEXT', 'NOTE'].map((v) => ({ value: v, label: v }))} /></Form.Item>
          <Form.Item name="detail" label="Nội dung" rules={[{ required: true, message: 'Nhập nội dung' }]}><Input.TextArea rows={4} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ============ DA07 — Test & nghiệm thu ============
function TestCasesTab() {
  const { message } = App.useApp();
  const { can } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const tcs = useQuery({
    queryKey: ['hub-tests'],
    queryFn: async () => (await api.get('/hub/test-cases')).data.testCases as HubTestCase[],
    retry: false,
  });
  const create = useMutation({
    mutationFn: async (vars: any) => (await api.post('/hub/test-cases', vars)).data,
    onSuccess: () => { message.success('Đã tạo test case'); setOpen(false); form.resetFields(); qc.invalidateQueries({ queryKey: ['hub-tests'] }); },
    onError: (e) => message.error(apiError(e)),
  });
  const setResult = useMutation({
    mutationFn: async ({ id, result }: { id: string; result: string }) => (await api.patch(`/hub/test-cases/${id}`, { result })).data,
    onSuccess: () => { message.success('Đã cập nhật kết quả'); qc.invalidateQueries({ queryKey: ['hub-tests'] }); },
    onError: (e) => message.error(apiError(e)),
  });

  if (is403(tcs.error)) return <Forbidden />;
  if (tcs.isLoading) return <Spin />;
  if (tcs.error) return <Alert type="error" message="Không tải được test case" />;

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'flex-end' }}>
        {can('hub.write') && <Button type="primary" onClick={() => setOpen(true)}>Tạo test case</Button>}
      </Space>
      <Table<HubTestCase>
        rowKey="id"
        dataSource={tcs.data ?? []}
        columns={[
          { title: 'Tính năng', dataIndex: 'featureId', width: 110, render: (f: string) => <Tag>{f}</Tag> },
          { title: 'Các bước', dataIndex: 'steps', render: (s: string | null) => s || '—' },
          { title: 'Kỳ vọng', dataIndex: 'expected', render: (s: string | null) => s || '—' },
          { title: 'Kết quả', dataIndex: 'result', width: 110, render: (r: string) => <Tag color={RESULT_COLOR[r] ?? 'default'}>{r}</Tag> },
          {
            title: 'Chạy', width: 190,
            render: (_: unknown, tc: HubTestCase) => can('hub.write') ? (
              <Select size="small" style={{ width: 170 }} value={tc.result} onChange={(result) => setResult.mutate({ id: tc.id, result })} options={['PASS', 'FAIL', 'NOT_RUN'].map((v) => ({ value: v, label: v }))} />
            ) : null,
          },
        ]}
      />

      <Modal title="Tạo test case" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} confirmLoading={create.isPending} okText="Lưu" cancelText="Hủy">
        <Form form={form} layout="vertical" initialValues={{ result: 'NOT_RUN' }} onFinish={(v) => create.mutate(v)}>
          <Form.Item name="featureId" label="Mã tính năng" rules={[{ required: true, message: 'Nhập mã tính năng' }]}><Input placeholder="vd: U02.4" /></Form.Item>
          <Form.Item name="steps" label="Các bước"><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="expected" label="Kỳ vọng"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ============ DA08 — Quyết định ============
function DecisionsTab() {
  const { message } = App.useApp();
  const { can } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const decisions = useQuery({
    queryKey: ['hub-decisions'],
    queryFn: async () => (await api.get('/hub/decisions')).data.decisions as HubDecision[],
    retry: false,
  });
  const create = useMutation({
    mutationFn: async (vars: any) => (await api.post('/hub/decisions', vars)).data,
    onSuccess: () => { message.success('Đã ghi quyết định'); setOpen(false); form.resetFields(); qc.invalidateQueries({ queryKey: ['hub-decisions'] }); },
    onError: (e) => message.error(apiError(e)),
  });

  if (is403(decisions.error)) return <Forbidden />;
  if (decisions.isLoading) return <Spin />;
  if (decisions.error) return <Alert type="error" message="Không tải được quyết định" />;

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'flex-end' }}>
        {can('hub.write') && <Button type="primary" onClick={() => setOpen(true)}>Ghi quyết định</Button>}
      </Space>
      {(decisions.data ?? []).map((d) => (
        <Descriptions key={d.id} bordered size="small" column={1} style={{ marginBottom: 16 }} title={d.title}>
          <Descriptions.Item label="Quyết định">{d.decision}</Descriptions.Item>
          <Descriptions.Item label="Thẩm quyền">{d.authority || '—'}</Descriptions.Item>
          <Descriptions.Item label="Lý do">{d.reason || '—'}</Descriptions.Item>
          <Descriptions.Item label="Thời điểm">{new Date(d.decidedAt).toLocaleString('vi-VN')}</Descriptions.Item>
        </Descriptions>
      ))}
      {(decisions.data ?? []).length === 0 && <Typography.Text type="secondary">Chưa có quyết định</Typography.Text>}

      <Modal title="Ghi quyết định" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} confirmLoading={create.isPending} okText="Lưu" cancelText="Hủy">
        <Form form={form} layout="vertical" onFinish={(v) => create.mutate(v)}>
          <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, message: 'Nhập tiêu đề' }]}><Input /></Form.Item>
          <Form.Item name="decision" label="Nội dung quyết định" rules={[{ required: true, message: 'Nhập nội dung' }]}><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="authority" label="Thẩm quyền"><Input placeholder="Người/đơn vị quyết định" /></Form.Item>
          <Form.Item name="reason" label="Lý do"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export function HubPage() {
  const { can } = useAuth();
  if (!can('hub.read')) return <Forbidden />;
  return (
    <div>
      <Typography.Title level={4}>SHMS Project Hub</Typography.Title>
      <Tabs
        items={[
          { key: 'docs', label: 'Tài liệu & review', children: <DocumentsTab /> },
          { key: 'tasks', label: 'Task & phân công', children: <TasksTab /> },
          { key: 'trace', label: 'Ma trận truy vết', children: <TraceabilityTab /> },
          { key: 'events', label: 'Context & handoff', children: <EventsTab /> },
          { key: 'tests', label: 'Test & nghiệm thu', children: <TestCasesTab /> },
          { key: 'decisions', label: 'Quyết định', children: <DecisionsTab /> },
        ]}
      />
    </div>
  );
}

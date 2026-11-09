import { useState } from 'react';
import { Card, Button, Typography, Space, Input, Alert, Form, Modal, App, Tag } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { api, apiError } from '../api/client';
import { useAuth } from '../store/auth';

export function SecurityPage() {
  const { message } = App.useApp();
  const { user, loadMe } = useAuth();
  const [setup, setSetup] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [enableOpen, setEnableOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [enableForm] = Form.useForm();
  const [disableForm] = Form.useForm();

  const twofaEnabled = (user as any)?.twofaEnabled ?? false;

  const startSetup = useMutation({
    mutationFn: async () => (await api.post('/auth/2fa/setup')).data,
    onSuccess: (data) => { setSetup(data); setEnableOpen(true); },
    onError: (e) => message.error(apiError(e)),
  });
  const enable = useMutation({
    mutationFn: async (totp: string) => (await api.post('/auth/2fa/enable', { totp })).data,
    onSuccess: async () => { message.success('Đã bật 2FA'); setEnableOpen(false); setSetup(null); enableForm.resetFields(); await loadMe(); },
    onError: (e) => message.error(apiError(e)),
  });
  const disable = useMutation({
    mutationFn: async (password: string) => (await api.post('/auth/2fa/disable', { password })).data,
    onSuccess: async () => { message.success('Đã tắt 2FA'); setDisableOpen(false); disableForm.resetFields(); await loadMe(); },
    onError: (e) => message.error(apiError(e)),
  });

  return (
    <div>
      <Typography.Title level={4}>Bảo mật tài khoản</Typography.Title>
      <Card title="Xác thực 2 lớp (2FA / TOTP)" style={{ maxWidth: 640 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            Trạng thái: {twofaEnabled ? <Tag color="green">Đang bật</Tag> : <Tag>Đang tắt</Tag>}
          </div>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Dùng app xác thực (Google Authenticator, Authy...) quét mã hoặc nhập khóa bí mật thủ công.
          </Typography.Paragraph>
          {twofaEnabled ? (
            <Button danger onClick={() => setDisableOpen(true)}>Tắt 2FA</Button>
          ) : (
            <Button type="primary" loading={startSetup.isPending} onClick={() => startSetup.mutate()}>Thiết lập 2FA</Button>
          )}
        </Space>
      </Card>

      <Modal title="Bật 2FA" open={enableOpen} onCancel={() => { setEnableOpen(false); setSetup(null); }} onOk={() => enableForm.submit()} confirmLoading={enable.isPending} okText="Xác nhận bật" cancelText="Hủy">
        {setup && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Alert type="info" message="Thêm khóa sau vào app xác thực" />
            <Input.TextArea readOnly value={setup.otpauthUri} rows={2} />
            <div>Khóa bí mật: <Typography.Text code copyable>{setup.secret}</Typography.Text></div>
            <Form form={enableForm} layout="vertical" onFinish={(v) => enable.mutate(v.totp)}>
              <Form.Item name="totp" label="Nhập mã 6 số từ app để xác minh" rules={[{ required: true, message: 'Nhập mã' }]}>
                <Input maxLength={6} placeholder="000000" />
              </Form.Item>
            </Form>
          </Space>
        )}
      </Modal>

      <Modal title="Tắt 2FA" open={disableOpen} onCancel={() => setDisableOpen(false)} onOk={() => disableForm.submit()} confirmLoading={disable.isPending} okText="Tắt 2FA" okButtonProps={{ danger: true }} cancelText="Hủy">
        <Form form={disableForm} layout="vertical" onFinish={(v) => disable.mutate(v.password)}>
          <Form.Item name="password" label="Nhập mật khẩu để xác nhận" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

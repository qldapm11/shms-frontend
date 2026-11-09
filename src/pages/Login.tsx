import { Button, Card, Form, Input, Typography, App } from 'antd';
import { UserOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../store/auth';
import { apiError } from '../api/client';

export function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [need2fa, setNeed2fa] = useState(false);

  async function onFinish(v: { username: string; password: string; totp?: string }) {
    setLoading(true);
    try {
      await login(v.username, v.password, v.totp);
      message.success('Đăng nhập thành công');
      nav('/');
    } catch (e) {
      const code = axios.isAxiosError(e) ? e.response?.data?.error?.code : undefined;
      if (code === 'TWOFA_REQUIRED') {
        setNeed2fa(true);
        message.info('Tài khoản bật 2FA, nhập mã xác minh.');
      } else {
        if (code === 'TWOFA_INVALID') setNeed2fa(true);
        message.error(apiError(e));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#1565c0,#42a5f5)' }}>
      <Card style={{ width: 380, boxShadow: '0 8px 30px rgba(0,0,0,0.2)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Typography.Title level={3} style={{ color: '#1565c0', marginBottom: 0 }}>SHMS</Typography.Title>
          <Typography.Text type="secondary">Hệ thống Quản lý Bệnh viện Thông minh</Typography.Text>
        </div>
        <Form onFinish={onFinish} layout="vertical">
          <Form.Item name="username" rules={[{ required: true, message: 'Nhập tài khoản' }]}>
            <Input prefix={<UserOutlined />} placeholder="Tài khoản" size="large" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Mật khẩu" size="large" />
          </Form.Item>
          {need2fa && (
            <Form.Item name="totp" rules={[{ required: true, message: 'Nhập mã 2FA' }]}>
              <Input prefix={<SafetyOutlined />} placeholder="Mã xác minh 2FA (6 số)" size="large" maxLength={6} autoFocus />
            </Form.Item>
          )}
          <Button type="primary" htmlType="submit" block size="large" loading={loading}>Đăng nhập</Button>
        </Form>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 16, marginBottom: 0 }}>
          Demo: admin/admin123 · bacsi/bacsi123 · tiepdon/tiepdon123 · ketoan/ketoan123 · duocsi/duocsi123 · pm/pm123
        </Typography.Paragraph>
      </Card>
    </div>
  );
}

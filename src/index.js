import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css';
import App from './App';
import ErrorBoundary from './ErrorBoundary';

const root = ReactDOM.createRoot(document.getElementById('root'));

// Check if Google Client ID is available
const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;

if (!googleClientId) {
  console.error('REACT_APP_GOOGLE_CLIENT_ID is not set in environment variables');
}

root.render(
  <ErrorBoundary>
    {googleClientId ? (
      <GoogleOAuthProvider clientId={googleClientId}>
        <App />
      </GoogleOAuthProvider>
    ) : (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        backgroundColor: '#f8f9fa'
      }}>
        <h1 style={{ color: '#dc3545', marginBottom: '20px' }}>설정 오류</h1>
        <p style={{ color: '#6c757d' }}>Google Client ID가 설정되지 않았습니다.</p>
        <p style={{ color: '#6c757d', fontSize: '14px' }}>
          관리자에게 문의하거나 환경 변수를 확인해주세요.
        </p>
      </div>
    )}
  </ErrorBoundary>
);
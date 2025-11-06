import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css';
import App from './App';
import ErrorBoundary from './ErrorBoundary';

const root = ReactDOM.createRoot(document.getElementById('root'));

// Check if Google Client ID is available
const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || '205853716243-jc7tstuv9nq4e9peonufojdt2uph3vcb.apps.googleusercontent.com';

if (!process.env.REACT_APP_GOOGLE_CLIENT_ID) {
  console.warn('REACT_APP_GOOGLE_CLIENT_ID is not set in environment variables, using fallback');
}

root.render(
  <ErrorBoundary>
    <GoogleOAuthProvider clientId={googleClientId}>
      <App />
    </GoogleOAuthProvider>
  </ErrorBoundary>
);
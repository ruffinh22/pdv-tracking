import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

// Global handler to suppress noisy "Uncaught (in promise)" logs for
// API responses that the backend currently encodes as a 200 with
// `{ code: 403 }` or replies with 429. We still log a friendly warning
// so developers see the issue, but avoid spamming the console with red
// errors for expected permission/rate-limit responses.
window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  const reason = event.reason as any;
  if (!reason) return;
  const isApi403 = reason?.code === 403 || reason?.response?.data?.code === 403 || reason?.response?.status === 403;
  const isRateLimit = reason?.response?.status === 429;
  if (isApi403 || isRateLimit) {
    console.warn('Suppressed API rejection:', isApi403 ? '403 Forbidden' : '429 Too Many Requests', reason);
    event.preventDefault();
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

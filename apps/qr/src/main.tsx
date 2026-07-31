import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

/**
 * The E2eBanner was removed with the V1 ContactForm. The QR card submits nothing and
 * no longer consumes a form endpoint, so an "e2e mode" warning here would describe a
 * backend connection that does not exist.
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

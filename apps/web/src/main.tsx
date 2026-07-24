import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { E2eBanner } from '@axispoint/brand';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <E2eBanner />
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

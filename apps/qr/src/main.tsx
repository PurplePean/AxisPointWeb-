import React from 'react';
import ReactDOM from 'react-dom/client';
import Root from './Root';
import './index.css';

/**
 * Mounting only. Everything the app renders lives in `Root`, so it can be rendered by a
 * test without a DOM. See the note there for why the e2e banner is mounted again.
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);

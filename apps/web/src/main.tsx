import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { E2eBanner } from '@axispoint/brand';
import App from './App';
import { LocaleProvider } from './i18n/LocaleProvider';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <E2eBanner />
    {/*
      THE ROUTER NOW WRAPS THE LOCALE PROVIDER, not the other way round.
      Since PR 5 the URL is the source of truth for page locale, so the provider has to read
      the router's location and navigate when the language changes. It cannot do either from
      outside.
    */}
    <BrowserRouter>
      <LocaleProvider>
        <App />
      </LocaleProvider>
    </BrowserRouter>
  </React.StrictMode>
);

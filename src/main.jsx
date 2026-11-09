import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import shopify from './catalog.json';
import local from '../data/local.json';
import renders from '../data/renders.json';
import lead from '../data/lead.json';
import framed from '../data/framed.json';
import pretty from '../data/pretty.json';
import recommend from '../data/recommend.json';
import weights from '../data/weights.json';
import { buildCatalog, mergeLocal } from './lib/catalog.js';
import { loadDrops } from './lib/drops.js';
import App from './App.jsx';
import { initAnalytics } from './lib/analytics.js';

initAnalytics();

/** If anything throws while drawing, a legible page with a way to reach the house, never a blank one. */
class ErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error, info) { console.error('[catalogue]', error, info); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center', fontFamily: 'Georgia, serif' }}>
        <p style={{ letterSpacing: '.3em', fontSize: 22, color: '#3A0000' }}>MINA</p>
        <p style={{ marginTop: 16, maxWidth: 380, lineHeight: 1.6 }}>Something went wrong loading this page. Please refresh, or reach us on WhatsApp.</p>
        <a href="https://wa.me/923161930960" style={{ marginTop: 16, color: '#3A0000' }}>+92 316 1930960</a>
      </div>
    );
  }
}

loadDrops().then(({ images, overrides }) => {
  const cat = buildCatalog({ ...mergeLocal(shopify, local, renders), lead, framed, pretty, recommend, weights, overrides }, images);
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ErrorBoundary><App cat={cat} /></ErrorBoundary>
    </React.StrictMode>,
  );
});

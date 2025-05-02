import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { JobStatusProvider } from './context/JobStatusContext'; // 👈 Import

const rootElement = document.getElementById('root');

if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <JobStatusProvider> {/* 👈 Wrap App with Provider */}
      <App />
    </JobStatusProvider>
  );
} else {
  console.error("Error: #root element not found!");
}
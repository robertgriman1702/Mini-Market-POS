import React    from 'react';
import ReactDOM  from 'react-dom/client';
import App       from './App';
import { ThemeProvider } from './components/ThemeProvider';
import './globals.css';

const root = document.getElementById('root');
if (!root) throw new Error('No se encontró #root en el DOM.');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
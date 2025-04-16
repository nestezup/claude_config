import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import App from './App';

// Using createElement instead of JSX syntax
const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  React.createElement(React.StrictMode, null, 
    React.createElement(App)
  )
);

import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { LanguageProvider } from './context/LanguageContext';
import { LocationProvider } from './context/LocationContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <LanguageProvider>
    <LocationProvider>
      <App />
    </LocationProvider>
  </LanguageProvider>
);

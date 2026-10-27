import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, Translations, translations } from '../utils/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('pulse_lang');
      if (saved === 'en' || saved === 'tl') {
        return saved;
      }
      return 'tl'; // Default to Tagalog for Brgy 40 & 41 residents
    } catch {
      return 'tl';
    }
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('pulse_lang', lang);
    } catch (e) {
      console.warn('Could not save language to localStorage:', e);
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'tl' ? 'en' : 'tl');
  };

  useEffect(() => {
    document.documentElement.lang = language === 'tl' ? 'fil' : 'en';
  }, [language]);

  const value: LanguageContextType = {
    language,
    setLanguage,
    toggleLanguage,
    t: translations[language],
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

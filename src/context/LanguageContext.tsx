import React, { createContext, useContext, useState } from 'react';
import { AppLanguage } from '../types/crm';
import { TRANSLATIONS } from '../i18n/translations';

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: () => {},
  t: (k) => k,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLangState] = useState<AppLanguage>(() => {
    const saved = localStorage.getItem('nivaasos_lang');
    if (saved === 'en' || saved === 'hi' || saved === 'mr') return saved;
    return 'en';
  });

  const setLanguage = (lang: AppLanguage) => {
    setLangState(lang);
    localStorage.setItem('nivaasos_lang', lang);
  };

  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

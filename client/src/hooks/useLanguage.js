import { useTranslation } from 'react-i18next';
import { useCallback } from 'react';
import { api } from '../lib/api.js';
import i18n from '../i18n/index.js';

export function useLanguage() {
  const { i18n: i18nInstance } = useTranslation();

  const changeLanguage = useCallback(async (lang) => {
    await i18nInstance.changeLanguage(lang);
    localStorage.setItem('ft_language', lang);
    // Persist to server — fail silently (offline or error)
    try {
      await api.patch('/api/auth/me', { language: lang });
    } catch {
      // Ignore — localStorage ensures correct language on next load
    }
  }, [i18nInstance]);

  return { language: i18nInstance.language, changeLanguage };
}

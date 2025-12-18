import { useTranslation } from 'react-i18next';

/**
 * Custom hook for widget translations
 * Provides translation function with widget-specific namespace and fallback support
 */
export const useWidgetTranslation = () => {
  const { t, i18n } = useTranslation();

  /**
   * Translate a key with flexible namespace support
   * Supports translation keys in various formats and direct strings
   * 
   * Translation key formats supported:
   * - "widgets:common.addItem" - Namespaced key (for widget-specific translations)
   * - "Name" - Direct string (will be looked up in flat translation structure)
   * - "sections.personalDetails" - Nested key (for backward compatibility)
   * 
   * With flat translation structure, direct strings like "Name" are automatically
   * translated by looking them up in the translation resources.
   * 
   * @param keyOrString - Translation key (e.g., "widgets:common.addItem") or direct string (e.g., "Name")
   * @param options - Translation options (interpolation values, default value, etc.)
   * @returns Translated string or original string if translation not found
   */
  const translate = (
    keyOrString: string | undefined | null,
    options?: {
      defaultValue?: string;
      [key: string]: any;
    }
  ): string => {
    if (!keyOrString) {
      return options?.defaultValue || '';
    }

    // Always try to translate - i18next will return the key if translation not found
    // This allows flat translation structure where "Name" is looked up directly
    const translated = t(keyOrString, { ...options, defaultValue: keyOrString });
    
    // If translation returned the key itself (meaning no translation found),
    // return it as-is (fallback to original string)
    return translated;
  };

  /**
   * Translate widget config property
   * Checks if the value is a translation key or direct string
   */
  const translateConfig = (
    value: string | undefined | null,
    fallback?: string
  ): string => {
    if (!value) {
      return fallback || '';
    }
    return translate(value, { defaultValue: fallback || value });
  };

  /**
   * Get current language
   */
  const getLanguage = (): string => {
    return i18n.language || 'en';
  };

  /**
   * Change language
   */
  const changeLanguage = (lng: string): Promise<void> => {
    return i18n.changeLanguage(lng).then(() => undefined);
  };

  return {
    t: translate,
    translate,
    translateConfig,
    getLanguage,
    changeLanguage,
    i18n,
  };
};

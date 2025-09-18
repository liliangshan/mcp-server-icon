// Language pack utility
const fs = require('fs');
const path = require('path');

// Available languages
const AVAILABLE_LANGUAGES = ['en', 'zh-CN'];

// Default language
const DEFAULT_LANGUAGE = 'en';

// Current language
let currentLanguage = DEFAULT_LANGUAGE;

// Language data cache
let languageData = null;

/**
 * Set the current language
 * @param {string} lang - Language code (e.g., 'en', 'zh-CN')
 */
function setLanguage(lang) {
  if (AVAILABLE_LANGUAGES.includes(lang)) {
    currentLanguage = lang;
    languageData = null; // Clear cache to reload
  } else {
    console.warn(`Unsupported language: ${lang}, falling back to ${DEFAULT_LANGUAGE}`);
    currentLanguage = DEFAULT_LANGUAGE;
    languageData = null;
  }
}

/**
 * Get the current language
 * @returns {string} Current language code
 */
function getCurrentLanguage() {
  return currentLanguage;
}

/**
 * Load language data
 * @param {string} lang - Language code
 * @returns {Object} Language data
 */
function loadLanguageData(lang) {
  try {
    const langPath = path.join(__dirname, `${lang}.js`);
    if (fs.existsSync(langPath)) {
      return require(langPath);
    } else {
      console.warn(`Language file not found: ${langPath}, falling back to ${DEFAULT_LANGUAGE}`);
      return require(path.join(__dirname, `${DEFAULT_LANGUAGE}.js`));
    }
  } catch (error) {
    console.error(`Error loading language ${lang}:`, error.message);
    return require(path.join(__dirname, `${DEFAULT_LANGUAGE}.js`));
  }
}

/**
 * Get language data (with caching)
 * @returns {Object} Current language data
 */
function getLanguageData() {
  if (!languageData) {
    languageData = loadLanguageData(currentLanguage);
  }
  return languageData;
}

/**
 * Get a localized string
 * @param {string} key - Dot notation key (e.g., 'server.starting')
 * @param {Object} params - Parameters for string interpolation
 * @returns {string} Localized string
 */
function t(key, params = {}) {
  const data = getLanguageData();
  const keys = key.split('.');
  let value = data;
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      console.warn(`Translation key not found: ${key}`);
      return key; // Return the key if translation not found
    }
  }
  
  if (typeof value !== 'string') {
    console.warn(`Translation value is not a string: ${key}`);
    return key;
  }
  
  // Simple parameter replacement
  return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
    return params[paramKey] !== undefined ? params[paramKey] : match;
  });
}

/**
 * Initialize language from environment variable
 */
function initFromEnv() {
  const envLang = process.env.LANGUAGE || process.env.LANG || DEFAULT_LANGUAGE;
  setLanguage(envLang);
}

/**
 * Get available languages
 * @returns {Array} Array of available language codes
 */
function getAvailableLanguages() {
  return [...AVAILABLE_LANGUAGES];
}

module.exports = {
  setLanguage,
  getCurrentLanguage,
  t,
  initFromEnv,
  getAvailableLanguages,
  AVAILABLE_LANGUAGES,
  DEFAULT_LANGUAGE
};

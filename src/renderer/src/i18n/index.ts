import { createI18n } from 'vue-i18n'
import en from './en'
import zh from './zh'

export type FireLocale = 'en' | 'zh'

function detectLocale(): FireLocale {
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

export const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: 'en',
  messages: {
    en,
    zh
  }
})

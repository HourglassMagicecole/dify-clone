import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import resourcesToBackend from 'i18next-resources-to-backend'

// Read language from localStorage (client-side only)
const getInitialLanguage = () => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('preferred_language')
    if (saved) return saved
  }
  return 'ko-KR'
}

i18n
  .use(initReactI18next)
  .use(
    resourcesToBackend((language: string, namespace: string) => {
      return import(`./${language}/${namespace}.json`)
    })
  )
  .init({
    lng: getInitialLanguage(),
    fallbackLng: 'ko-KR',
    debug: false,
    interpolation: {
      escapeValue: false,
    },
  })

export default i18n

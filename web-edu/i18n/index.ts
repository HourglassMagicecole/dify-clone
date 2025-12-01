import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import resourcesToBackend from 'i18next-resources-to-backend'

// Initialize with fallback language to avoid SSR hydration mismatch
// Language will be set from localStorage in Providers after client mount
i18n
  .use(initReactI18next)
  .use(
    resourcesToBackend((language: string, namespace: string) => {
      return import(`./${language}/${namespace}.json`)
    })
  )
  .init({
    lng: 'ko-KR', // Always start with fallback to match SSR
    fallbackLng: 'ko-KR',
    ns: ['common', 'agent', 'dataset'], // Load common, agent, and dataset namespaces by default
    defaultNS: 'common',
    debug: false,
    interpolation: {
      escapeValue: false,
    },
  })

export default i18n

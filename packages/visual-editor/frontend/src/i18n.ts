import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import cs from "./locales/cs.json";
import en from "./locales/en.json";

i18n
  .use(initReactI18next)
  .init({
    resources: {
      cs: { translation: cs },
      en: { translation: en },
    },
    lng: "cs",
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });

export default i18n;
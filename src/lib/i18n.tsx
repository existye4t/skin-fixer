import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "tr" | "en";

const copy = {
  tr: {
    brand: "Skin Fixer",
    source: "cslol-go",
    local: "Yerel · yüklenmez",
    heroA: "Skini onar.",
    heroB: "WAD bozulmadan.",
    lead: "cslol-go içindeki Skin Fixer, bir sayfa olarak. Modu içe al, aynı kontrolleri çalıştır, .modpkg indir.",
    cta: "Skinini düzelt",
    step1t: "İçe al",
    step1b: ".fantome, klasör zip’i veya çıkarılmış mod. Dosya makineden çıkmaz.",
    step2t: "Düzelt",
    step2b: "Bin, hash, ikon, ses ve küçük mod kontrolü. cslol-go ile aynı geçiş.",
    step3t: "İndir",
    step3b: "Uygulamanın okuduğu .modpkg. Zip değil.",
    back: "Skin Fixer",
    importKicker: "İçe aktar",
    dropTitle: "Skini bırak.",
    dropIdle: ".fantome veya çıkarılmış mod (.zip)",
    dropHint: "Bu makinede kalır.",
    champion: "Şampiyon",
    kind: "Tür",
    entries: "Girdi",
    size: "Boyut",
    bins: "Bin",
    skins: "Skinler",
    fix: "Skini düzelt",
    fixing: "Düzeltiliyor…",
    download: "İndir",
    kept: "korundu",
    dropped: "atıldı",
    repaths: "yol değişti",
    missing: "eksik",
    pass: "Geçiş",
    skinNo: "Skin numarası",
    affix: "Sonek",
    affixHint: "isteğe bağlı",
    allAvailable: "Tüm skinler",
    binless: "Sadece doğrula",
    noSkin: "Diğer skinlere uygula",
    keepIcons: "Yetenek ikonları",
    keepSfx: "Ses olayları",
    killStatic: "Statik materyaller",
    keepUi: "Arayüz dosyaları",
    smallMod: "Küçük mod",
    repathInFile: "Dosya içi yol",
    sound: "Ses",
    animation: "Animasyon",
    auto: "otomatik",
    include: "dahil",
    exclude: "hariç",
    on: "açık",
    off: "kapalı",
    badFile: "Bu dosya zip tabanlı bir fantome veya çıkarılmış mod değil.",
    unknown: "bilinmiyor",
    lang: "Dil",
    discord: "Discord",
    presence: "Durum",
    online: "çevrimiçi",
    idle: "boşta",
    dnd: "rahatsız etme",
    offline: "çevrimdışı",
    playing: "Oynuyor",
    listening: "Dinliyor",
    close: "Kapat",
    spotify: "Spotify",
    settings: "Ayarlar",
    reduceMotion: "Animasyonu azalt",
    reset: "Sıfırla",
    resetPage: "Sayfayı sıfırla",
    about: "Hakkında",
    aboutHow: "Bir .fantome içeri alınır, cslol-go’daki geçiş çalışır ve aynı isim, yapımcı ve kapakla .modpkg olarak geri iner. Dosya bu makineden çıkmaz.",
    aboutWho: "Umut, A.K.A. Exist tarafından yapıldı. Skin Fixer, cslol-go’nun masaüstü aracıdır; bu sayfa aynı geçişi tarayıcıya taşır.",
    scroll: "Aşağı",
  },
  en: {
    brand: "Skin Fixer",
    source: "cslol-go",
    local: "Local · never uploaded",
    heroA: "Repair the skin.",
    heroB: "Before the wad breaks.",
    lead: "The Skin Fixer from cslol-go, as a page. Import the mod, run the same pass, download a .modpkg.",
    cta: "Fix a skin",
    step1t: "Import",
    step1b: "A .fantome or an extracted mod zip. The file never leaves this machine.",
    step2t: "Fix",
    step2b: "Bins, hashes, icons, sound, and the small-mod check. The same pass as cslol-go.",
    step3t: "Download",
    step3b: "A .modpkg the app can read. Not a zip.",
    back: "Skin Fixer",
    importKicker: "Import",
    dropTitle: "Drop the skin.",
    dropIdle: ".fantome or extracted mod (.zip)",
    dropHint: "Stays on this machine.",
    champion: "Champion",
    kind: "Kind",
    entries: "Entries",
    size: "Size",
    bins: "Bins",
    skins: "Skins",
    fix: "Fix skin",
    fixing: "Fixing…",
    download: "Download",
    kept: "kept",
    dropped: "dropped",
    repaths: "repaths",
    missing: "missing",
    pass: "Pass",
    skinNo: "Skin number",
    affix: "Suffix",
    affixHint: "optional",
    allAvailable: "All skins",
    binless: "Verify only",
    noSkin: "Apply to other skins",
    keepIcons: "Ability icons",
    keepSfx: "Sound events",
    killStatic: "Static materials",
    keepUi: "Interface files",
    smallMod: "Small mod",
    repathInFile: "Repath inside files",
    sound: "Sound",
    animation: "Animation",
    auto: "auto",
    include: "include",
    exclude: "exclude",
    on: "on",
    off: "off",
    badFile: "This file is not a zip-based fantome or extracted mod.",
    unknown: "unknown",
    lang: "Language",
    discord: "Discord",
    presence: "Status",
    online: "online",
    idle: "idle",
    dnd: "do not disturb",
    offline: "offline",
    playing: "Playing",
    listening: "Listening",
    close: "Close",
    spotify: "Spotify",
    settings: "Settings",
    reduceMotion: "Reduce animation",
    reset: "Reset",
    resetPage: "Reset page",
    about: "About",
    aboutHow: "Import a .fantome, run the same pass cslol-go runs, and download a .modpkg with the original name, author, and cover. The file never leaves this machine.",
    aboutWho: "Made by Umut, A.K.A. Exist. Skin Fixer belongs to cslol-go; this page carries that pass into the browser.",
    scroll: "Down",
  },
} as const;

export type Copy = (typeof copy)[Lang];

type I18nValue = { lang: Lang; setLang: (lang: Lang) => void; t: Copy };

const I18nContext = createContext<I18nValue | null>(null);
const KEY = "skin-fixer-lang";

function initialLang(): Lang {
  const stored = localStorage.getItem(KEY);
  if (stored === "tr" || stored === "en") return stored;
  return navigator.language.toLowerCase().startsWith("tr") ? "tr" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  useEffect(() => {
    localStorage.setItem(KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);
  return (
    <I18nContext.Provider value={{ lang, setLang: setLangState, t: copy[lang] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n outside provider");
  return value;
}

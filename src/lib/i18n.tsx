// Language switcher (Phase 7) — SHORT UI strings only: nav labels, header
// CTAs, the Home hero and the footer tagline, in English, Nigerian Pidgin,
// Yoruba and Hausa. Anything not translated falls back to English, and the
// footer carries the honest note: "Translations are expanding — some pages
// remain in English." Persisted in `oketex-lang`.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "pcm" | "yo" | "ha";
export const LANGS: { id: Lang; label: string }[] = [
  { id: "en", label: "English" }, { id: "pcm", label: "Pidgin" },
  { id: "yo", label: "Yorùbá" }, { id: "ha", label: "Hausa" },
];
const KEY = "oketex-lang";
export function getLang(): Lang {
  try { const v = localStorage.getItem(KEY); return v === "pcm" || v === "yo" || v === "ha" ? v : "en"; } catch { return "en"; }
}
export function setLangStored(l: Lang) { try { localStorage.setItem(KEY, l); } catch { /* ignore */ } }

type Dict = Record<string, Partial<Record<Lang, string>> & { en: string }>;
export const DICT: Dict = {
  "nav.shop": { en: "Shop", pcm: "Shop", yo: "Ìtajà", ha: "Shago" },
  "nav.quote": { en: "Quote", pcm: "Get Price", yo: "Ìdíyelé", ha: "Farashi" },
  "nav.estimator": { en: "Estimator", pcm: "Estimator", yo: "Aṣírò", ha: "Kiyasi" },
  "nav.visualizer": { en: "Visualizer", pcm: "Visualizer", yo: "Ìfarahàn", ha: "Kallon Farko" },
  "nav.tools": { en: "Tools", pcm: "Tools", yo: "Irínṣẹ́", ha: "Kayan Aiki" },
  "nav.build": { en: "Build A–Z", pcm: "Build A–Z", yo: "Kọ́ A–Z", ha: "Gina A–Z" },
  "nav.workspace": { en: "Workspace", pcm: "Work Yard", yo: "Ibi Iṣẹ́", ha: "Wurin Aiki" },
  "nav.documents": { en: "Documents", pcm: "Documents", yo: "Ìwé Àkọsílẹ̀", ha: "Takardu" },
  "nav.book": { en: "Book", pcm: "Book Visit", yo: "Ìbẹ̀wò", ha: "Ziyara" },
  "nav.partners": { en: "Partners", pcm: "Partners", yo: "Ẹgbẹ́", ha: "Abokan Hulɗa" },
  "nav.gallery": { en: "Gallery", pcm: "Gallery", yo: "Àwòrán", ha: "Hotuna" },
  "nav.track": { en: "Track", pcm: "Track Am", yo: "Tẹ̀lé E", ha: "Bi Sawu" },
  "nav.assistant": { en: "Assistant", pcm: "Assistant", yo: "Olùrànlọ́wọ́", ha: "Mataimaki" },
  "nav.roofingGuide": { en: "Roofing Guide", pcm: "Roof Guide", yo: "Ìtọ́sọ́nà Òrùlé", ha: "Jagorar Rufi" },
  "nav.gopro": { en: "Go Pro", pcm: "Go Pro", yo: "Lọ Pro", ha: "Zuwa Pro" },
  "nav.snap": { en: "Snap-Measure", pcm: "Snap-Measure", yo: "Snap-Measure", ha: "Snap-Measure" },
  "nav.services": { en: "Services", pcm: "Services", yo: "Iṣẹ́", ha: "Ayyuka" },
  "nav.join": { en: "Join as Pro/Seller", pcm: "Join as Pro/Seller", yo: "Darapọ̀ Mọ́ Wa", ha: "Shiga Pro/Mai Sayarwa" },
  "nav.partnerStatus": { en: "Partner Status", pcm: "Partner Status", yo: "Ipò Ẹgbẹ́", ha: "Matsayin Aboki" },
  "nav.jobs": { en: "Jobs Board", pcm: "Jobs Board", yo: "Pátákó Iṣẹ́", ha: "Allon Ayyuka" },
  "nav.prices": { en: "Price Watch", pcm: "Price Watch", yo: "Ìṣọ́ Owó", ha: "Kallon Farashi" },
  "header.signin": { en: "Sign in", pcm: "Sign In", yo: "Wọlé", ha: "Shiga" },
  "header.admin": { en: "Admin", pcm: "Admin", yo: "Alábojútó", ha: "Mai Gudanarwa" },
  "hero.kicker": {
    en: "Aluminum roofing · Building materials · Est. 2009",
    pcm: "Aluminium roofing · Building materials · Since 2009",
    yo: "Òrùlé aluminiomu · Ohun èlò ìkọ́lé · Láti ọdún 2009",
    ha: "Rufin aluminium · Kayan gini · Tun 2009",
  },
  "hero.title1": { en: "Roofs that", pcm: "Roof wey go", yo: "Òrùlé tí yóò", ha: "Rufin da zai" },
  "hero.title2": { en: "outlast", pcm: "outlast", yo: "pẹ́ ju", ha: "ɗore" },
  "hero.title3": { en: "the rain", pcm: "the rain", yo: "òjò lọ", ha: "fiye da ruwan sama" },
  "hero.sub": {
    en: "Longspan sheets, stone-coated tiles, windows, doors and every accessory in between — fabricated in-house, priced per metre, and delivered anywhere in Nigeria.",
    pcm: "Longspan sheets, stone-coated tiles, windows, doors and every oda material wey dey between — na we dey make am for our own factory, price na per metre, and we dey deliver am go anywhere for Nigeria.",
    yo: "Lọ́ńgspan, táìlì stone-coated, fèrèsé, ìlẹ̀kùn àti gbogbo ohun èlò tó wà láàárín — a ṣe wọ́n ní ilé-iṣẹ́ wa, owó ní mítà kọ̀ọ̀kan, a sì ń gbé wọn lọ sí ibikíbi ní Nàìjíríà.",
    ha: "Takardun longspan, tayal mai rufin dutse, tagogi, kofofi da duk kayan da ke tsakaninsu — muna keransu a masana'antarmu, farashi a kowace mita, kuma muna isar da su ko'ina a Najeriya.",
  },
  "hero.ctaShop": { en: "Shop materials", pcm: "Shop materials", yo: "Ra ohun èlò", ha: "Sayi kaya" },
  "hero.ctaQuote": { en: "Pro Roof Calculator", pcm: "Calculate my roof price", yo: "Ṣírò iye òrùlé mi", ha: "Lissafa rufina" },
  "hero.ctaVisualize": { en: "Visualize my house", pcm: "See my house", yo: "Wo ilé mi ṣáájú", ha: "Duba gidana" },
  "footer.tagline": {
    en: "Built to outlast the rain",
    pcm: "We build am to outlast the rain",
    yo: "A kọ́ ọ láti pẹ́ ju òjò lọ",
    ha: "An gina shi ya ɗore fiye da ruwan sama",
  },
  "footer.blurb": {
    en: "Premium aluminum roofing, stone-coated tiles, windows, doors and building materials — fabricated, supplied and installed across Nigeria since 2009.",
    pcm: "Beta aluminium roofing, stone-coated tiles, windows, doors and building materials — we make am, supply am and install am for whole Nigeria since 2009.",
    yo: "Òrùlé aluminiomu tó dára, táìlì stone-coated, fèrèsé, ìlẹ̀kùn àti ohun èlò ìkọ́lé — a ṣe wọ́n, a ta wọ́n, a sì fi wọ́n sílẹ̀ káàkiri Nàìjíríà láti ọdún 2009.",
    ha: "Rufin aluminium mai kyau, tayal mai dutse, tagogi, kofofi da kayan gini — muna kerawa, samarwa da sakawa a duk fadin Najeriya tun 2009.",
  },
  "i18n.note": {
    en: "Translations are expanding — some pages remain in English.",
    pcm: "Translation still dey grow — some pages still dey English.",
    yo: "Ìtumọ̀ èdè ṣì ń dàgbà — àwọn ojú ìwé kan ṣì wà ní èdè Gẹ̀ẹ́sì.",
    ha: "Fassara na ci gaba da faɗaɗa — wasu shafuka har yanzu suna Turanci.",
  },
};
/** Pure translate with English fallback (unknown key → the key itself). */
export function translate(lang: Lang, key: string): string {
  const entry = DICT[key];
  if (!entry) return key;
  return entry[lang] ?? entry.en;
}

interface LangCtx { lang: Lang; setLang: (l: Lang) => void; t: (key: string) => string }
const Ctx = createContext<LangCtx>({ lang: "en", setLang: () => {}, t: (k) => translate("en", k) });
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => getLang());
  const setLang = (l: Lang) => { setLangStored(l); setLangState(l); };
  useEffect(() => {
    const h = () => setLangState(getLang());
    window.addEventListener("storage", h);
    return () => window.removeEventListener("storage", h);
  }, []);
  return <Ctx.Provider value={{ lang, setLang, t: (k) => translate(lang, k) }}>{children}</Ctx.Provider>;
}
export function useLang(): LangCtx { return useContext(Ctx); }
/** The switcher control itself (header + mobile menu share it). */
export function LanguageSelect({ className }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <select value={lang} onChange={e => setLang(e.target.value as Lang)} aria-label="Language"
      className={className || "bg-background border hairline font-tech text-xs px-2 py-2 cursor-pointer"}>
      {LANGS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
    </select>
  );
}

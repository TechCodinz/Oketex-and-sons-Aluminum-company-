export const NGN_PER_USD = 1550;
export const ORDER_STATUSES = ["pending","confirmed","processing","shipped","delivered","cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const QUOTE_STATUSES = ["new","reviewing","quoted","accepted","closed"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];
// NOTE: BUSINESS details below were carried over from the original OKComputer template.
// Phone, email, address, RC and stats (Est. 2009, 2,400 roofs, 36 states) look like
// template placeholders — CONFIRM with the business owner before public launch.
export const BUSINESS = {
  name: "Oketex & Sons Aluminum Co.",
  shortName: "Oketex & Sons",
  phone: "+234 803 555 0192",
  whatsapp: "2348035550192",
  email: "sales@oketexandsons.ng",
  address: "Km 12 Lagos–Ibadan Expressway, Ibafo, Ogun State, Nigeria",
  hours: "Mon–Sat · 7:30am – 6:00pm",
} as const;
export const WHATSAPP_LINK = (text: string) => `https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent(text)}`;

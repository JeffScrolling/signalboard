const DISPOSABLE = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.info",
  "guerrillamail.biz",
  "sharklasers.com",
  "grr.la",
  "yopmail.com",
  "yopmail.fr",
  "tempmail.com",
  "temp-mail.org",
  "10minutemail.com",
  "trashmail.com",
  "getnada.com",
  "dispostable.com",
  "mailnesia.com",
  "maildrop.cc",
  "fakeinbox.com",
  "throwawaymail.com",
  "mintemail.com",
  "mohmal.com",
  "emailondeck.com",
  "tempail.com",
  "discard.email",
  "spamgourmet.com",
  "mailcatch.com",
  "inboxkitten.com",
  "tmpmail.net",
  "moakt.com",
  "guerrillamail.net",
  "trashmail.de",
]);

export function isDisposableEmail(email: string) {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  if (DISPOSABLE.has(domain)) return true;
  for (const blocked of DISPOSABLE) {
    if (domain.endsWith(`.${blocked}`)) return true;
  }
  return false;
}

export function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

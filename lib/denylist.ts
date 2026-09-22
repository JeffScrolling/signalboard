export type DenyRule = {
  pattern: RegExp;
  category: string;
  freeze: boolean;
};

export const DENYLIST: DenyRule[] = [
  { pattern: /\bcsam\b/i, category: "sexual_minors", freeze: true },
  { pattern: /child\s*porn/i, category: "sexual_minors", freeze: true },
  { pattern: /underage\s*(porn|sex)/i, category: "sexual_minors", freeze: true },
  { pattern: /phishing\s*kit/i, category: "scam", freeze: false },
  { pattern: /credential\s*harvest/i, category: "scam", freeze: false },
  { pattern: /guaranteed\s+returns/i, category: "scam", freeze: false },
  { pattern: /\bwarez\b/i, category: "malware", freeze: false },
  { pattern: /ransomware\s*(builder|kit)/i, category: "malware", freeze: false },
  { pattern: /malware\s*dropper/i, category: "malware", freeze: false },
  { pattern: /\bporn(?:ography)?\b/i, category: "sexual", freeze: false },
  { pattern: /\bxxx\b/i, category: "sexual", freeze: false },
  { pattern: /beheading\s*video/i, category: "violence", freeze: false },
  { pattern: /\bheil\s+hitler\b/i, category: "hate", freeze: false },
  { pattern: /\bwhite\s+power\b/i, category: "hate", freeze: false },
];

export const CATEGORIES = [
  { key: 'all', emoji: '🛒', label: 'Semua' },
  { key: 'beras', emoji: '🌾', label: 'Beras' },
  { key: 'protein', emoji: '🥩', label: 'Protein' },
  { key: 'sayuran', emoji: '🥬', label: 'Sayuran' },
  { key: 'bumbu', emoji: '🌶️', label: 'Bumbu' },
  { key: 'minyak', emoji: '🫙', label: 'Minyak & Gula' },
  { key: 'lainnya', emoji: '📦', label: 'Lainnya' },
];

export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  beras: ['beras'],
  protein: ['daging', 'ayam', 'telur', 'ikan', 'udang'],
  sayuran: [
    'tomat',
    'sawi',
    'kangkung',
    'buncis',
    'kacang panjang',
    'timun',
    'kentang',
    'wortel',
    'bayam',
  ],
  bumbu: ['bawang', 'cabai', 'jahe', 'kunyit', 'ketumbar'],
  minyak: ['minyak', 'gula', 'garam', 'minyakita'],
  lainnya: [
    'susu',
    'tahu',
    'tempe',
    'tepung',
    'mie',
    'kedelai',
    'kacang hijau',
    'kacang tanah',
    'pisang',
    'jeruk',
  ],
};

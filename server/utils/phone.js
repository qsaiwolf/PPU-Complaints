/**
 * Palestine Polytechnic University (PPU) - Complaints System
 * Phone & WhatsApp Normalization Utility
 * Strictly supports 'ps' (+970 / Palestine) and 'il' (+972 / Israel / 48 Regions)
 */

export const SUPPORTED_COUNTRIES = {
  ps: {
    code: 'ps',
    dialCode: '970',
    dialPrefix: '+970',
    nameAr: 'فلسطين (Jawwal / Ooredoo)',
    flag: '🇵🇸',
    example: '0599123456 / 0568123456',
    nationalLength: [9, 10], // e.g. 0599123456 (10) or 599123456 (9)
    mobileRegex: /^(059|056|59|56)\d{7}$/
  },
  il: {
    code: 'il',
    dialCode: '972',
    dialPrefix: '+972',
    nameAr: 'الداخل ومناطق 48',
    flag: '🇮🇱',
    example: '0501234567 / 0541234567',
    nationalLength: [9, 10], // e.g. 0501234567 (10) or 501234567 (9)
    mobileRegex: /^(050|051|052|053|054|055|058|50|51|52|53|54|55|58)\d{7}$/
  }
};

/**
 * Convert Arabic/Eastern numerals to Western ASCII digits
 */
export function normalizeDigits(str = '') {
  return String(str || '')
    .trim()
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[^\d+]/g, '');
}

/**
 * Validate and format phone number for WhatsApp
 * @param {string} phoneCountry - 'ps' or 'il'
 * @param {string} rawPhone - National phone number
 * @returns {object} { isValid, country, dialCode, nationalNumber, internationalNumber, waNumber, waUrl, error }
 */
export function normalizePhoneNumber(phoneCountry, rawPhone) {
  if (!rawPhone || !String(rawPhone).trim()) {
    return {
      isValid: false,
      isEmpty: true,
      country: null,
      dialCode: null,
      nationalNumber: '',
      internationalNumber: '',
      waNumber: '',
      waUrl: '',
      error: 'رقم الهاتف فارغ.'
    };
  }

  const countryKey = String(phoneCountry || 'ps').trim().toLowerCase();
  const countryConfig = SUPPORTED_COUNTRIES[countryKey];

  if (!countryConfig) {
    return {
      isValid: false,
      country: countryKey,
      error: 'الدولة المحددة غير مدعومة. البلدان المدعومة فقط: ps (فلسطين) أو il (الداخل).'
    };
  }

  let cleaned = normalizeDigits(rawPhone);

  // If user entered with + or international prefix, clean it
  if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);
  if (cleaned.startsWith(countryConfig.dialCode)) {
    cleaned = cleaned.slice(countryConfig.dialCode.length);
  }

  // Strip leading 0
  const digitsOnly = cleaned.replace(/^0+/, '');

  // Check valid length and pattern
  const isValidMobile = countryConfig.mobileRegex.test(cleaned) || /^\d{9}$/.test(digitsOnly);

  if (!isValidMobile || digitsOnly.length !== 9) {
    return {
      isValid: false,
      country: countryKey,
      nationalNumber: cleaned,
      error: `رقم الهاتف غير صحيح للدولة المحددة (${countryConfig.nameAr}). صيغة الرقم المقبولة تتكون من 9 أو 10 أرقام (مثال: ${countryConfig.example}).`
    };
  }

  // Clean formatted international number without '+' for WhatsApp (e.g. 970599123456)
  const waNumber = `${countryConfig.dialCode}${digitsOnly}`;
  const internationalNumber = `+${waNumber}`;
  const formattedNational = `0${digitsOnly.slice(0, 2)}-${digitsOnly.slice(2, 5)}-${digitsOnly.slice(5)}`;

  return {
    isValid: true,
    country: countryKey,
    countryName: countryConfig.nameAr,
    countryFlag: countryConfig.flag,
    dialCode: countryConfig.dialCode,
    dialPrefix: countryConfig.dialPrefix,
    nationalNumber: digitsOnly,
    formattedNational,
    internationalNumber,
    waNumber,
    waUrl: `https://wa.me/${waNumber}`
  };
}

/**
 * Generate a WhatsApp click-to-chat URL with pre-filled message text
 */
export function buildWhatsAppLink(waNumber, text = '') {
  if (!waNumber) return '';
  const cleanNumber = waNumber.replace(/[^\d]/g, '');
  const encodedText = encodeURIComponent(text);
  return `https://wa.me/${cleanNumber}?text=${encodedText}`;
}

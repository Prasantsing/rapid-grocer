/**
 * Hinglish & Colloquial Indian Grocery Search Dictionary
 * Maps common vernacular terms (Hindi, Hinglish, Marathi, Kannada, Tamil phonetic terms)
 * to English catalog equivalents and vice-versa.
 */

const ALIAS_GROUPS = [
  // Dairy & Morning
  ['milk', 'doodh', 'dudh', 'दूध', 'दोध', 'paal', 'பால்', 'haalu', 'ಹಾಲು', 'palu', 'పాలు', 'dairy', 'toned milk', 'cow milk'],
  ['curd', 'dahi', 'दही', 'mosaru', 'ಮೊಸರು', 'tayir', 'தயிர்', 'perugu', 'పెరుగు', 'yogurt', 'greek yogurt'],
  ['paneer', 'cottage cheese', 'chenna', 'पनीर', 'ಪನ್ನೀರ್', 'பன்னீர்'],
  ['butter', 'makhan', 'मक्खन', 'benne', 'ಬೆಣ್ಣೆ', 'vennai', 'வெண்ணெய்'],
  ['ghee', 'neyyi', 'tup', 'घी', 'तुप', 'ತುಪ್ಪ', 'நெய்', 'clarified butter'],
  ['cheese', 'cheddar', 'mozzarella', 'चीज़'],
  ['egg', 'eggs', 'anda', 'ande', 'अंडा', 'अंडे', 'muttai', 'முட்டை', 'motte', 'ಮೊಟ್ಟೆ'],
  ['bread', 'pav', 'loaf', 'bun', 'toast', 'ब्रेड', 'पाव'],

  // Vegetables
  ['potato', 'potatoes', 'aloo', 'alu', 'आलू', 'बटाटा', 'batata', 'urulaikizhangu', 'alugadde', 'ಆಲೂಗಡ್ಡೆ', 'bangaladumpa'],
  ['onion', 'onions', 'pyaaz', 'pyaz', 'प्याज', 'कांदा', 'kanda', 'vengayam', 'வெங்காயம்', 'eerulli', 'ಈರುಳ್ಳಿ'],
  ['tomato', 'tomatoes', 'tamatar', 'tomatar', 'टमाटर', 'thakkali', 'தக்காளி', 'ಟೊಮೆಟೊ', 'tamata'],
  ['ginger', 'adrak', 'अदरक', 'inji', 'இஞ்சி', 'shunti', 'ಶುಂಠಿ'],
  ['garlic', 'lahsun', 'lasun', 'लहसुन', 'लसूण', 'poondu', 'பூண்டு', 'bellulli', 'ಬೆಳ್ಳುಳ್ಳಿ'],
  ['chilli', 'chili', 'mirchi', 'mirch', 'मिर्ची', 'हरी मिर्च', 'hari mirch', 'green chilli', 'milagai', 'ಮೆಣಸಿನಕಾಯಿ'],
  ['coriander', 'dhaniya', 'dhania', 'धनिया', 'kothmir', 'kothamalli', 'கொத்தமல்லி', 'kothambari', 'ಕೊತ್ತಂಬರಿ'],
  ['spinach', 'palak', 'पालक', 'keerai', 'கீரை', 'soppu', 'ಸೊಪ್ಪು'],
  ['cucumber', 'kheera', 'kakdi', 'खीरा', 'काकडी', 'vellarikka', 'southekai', 'ಸೌತೆಕಾಯಿ'],
  ['lemon', 'nimbu', 'neebu', 'नींबू', 'elumichai', 'எலுமிச்சை', 'nimbe', 'ನಿಂಬೆ'],
  ['capsicum', 'shimla mirch', 'शिमला मिर्च', 'bell pepper'],
  ['cauliflower', 'gobhi', 'phool gobhi', 'फूल गोभी'],
  ['cabbage', 'patta gobhi', 'band gobhi', 'पत्ता गोभी'],
  ['carrot', 'gajar', 'गाजर', 'gajjari', 'ಗಜ್ಜರಿ'],
  ['peas', 'matar', 'muttar', 'मटर', 'batani', 'ಬಟಾಣಿ'],
  ['ladyfinger', 'bhindi', 'okra', 'भिंडी', 'vendakkai', 'ವೆಂಡೆಕಾಯಿ'],

  // Fruits
  ['banana', 'bananas', 'kela', 'kele', 'केला', 'केळी', 'vazhaipazham', 'வாழைப்பழம்', 'bale hannu', 'ಬಾಳೆಹಣ್ಣು'],
  ['apple', 'apples', 'seb', 'सेब', 'aappil', 'ಆಪಲ್'],
  ['mango', 'mangoes', 'aam', 'आम', 'manga', 'மாம்பழம்', 'mavinahannu', 'ಮಾವಿನಹಣ್ಣು'],
  ['orange', 'santhe', 'santra', 'संत्रा', 'narangi', 'ಕಿತ್ತಳೆ'],
  ['coconut', 'nariyal', 'नारियल', 'thekai', 'thengai', 'தேங்காய்', 'tender coconut', 'ಎಳನೀರು', 'thengina kayi'],
  ['watermelon', 'tarbooj', 'तरबूज', 'kalingad', 'ಕಲ್ಲಂಗಡಿ'],
  ['papaya', 'papita', 'पपीता', 'ಪರಂಗಿ'],

  // Staples & Kitchen
  ['rice', 'chawal', 'चावल', 'basmati', 'arisi', 'அரிசி', 'akki', 'ಅಕ್ಕಿ'],
  ['wheat', 'flour', 'atta', 'gehun', 'आटा', 'गेहूं', 'gothumai', 'godhi', 'ಗೋಧಿಹಿಟ್ಟು'],
  ['maida', 'all purpose flour', 'refined flour', 'मैदा'],
  ['besan', 'gram flour', 'chickpea flour', 'बेसन'],
  ['dal', 'daal', 'दाल', 'lentils', 'paruppu', 'பருப்பு', 'bele', 'ಬೇಳೆ'],
  ['toor dal', 'arhar', 'thuvaram', 'ತೊಗರಿ ಬೇಳೆ'],
  ['moong dal', 'mung', 'मूंग दाल', 'pasi paruppu', 'ಹೆಸರು ಬೇಳೆ'],
  ['chana dal', 'chana', 'chole', 'चना', 'छोले', 'kadalai', 'ಕಡಲೆ ಬೇಳೆ'],
  ['urad dal', 'ulundhu', 'uddina bele', 'ಉದ್ದಿನ ಬೇಳೆ'],
  ['sugar', 'chini', 'cheeni', 'shakar', 'चीनी', 'शक्कर', 'sakkarai', 'சர்க்கரை', 'sakkare', 'ಸಕ್ಕರೆ'],
  ['salt', 'namak', 'नमक', 'uppu', 'உப்பு', 'ಉಪ್ಪು'],
  ['oil', 'tel', 'cooking oil', 'तेल', 'sunflower', 'mustard oil', 'sarson', 'yenne', 'ಎಣ್ಣೆ', 'ennai'],
  ['mustard', 'rai', 'sarson', 'राई', 'kadugu', 'கடுகு', 'sasive', 'ಸಾಸಿವೆ'],
  ['cumin', 'jeera', 'जीरा', 'seeragam', 'ಸೀರಗೆ', 'jeerige', 'ಜೀರಿಗೆ'],
  ['turmeric', 'haldi', 'हल्दी', 'manjal', 'மஞ்சள்', 'arishina', 'ಅರಿಶಿನ'],

  // Tea, Coffee & Beverages
  ['tea', 'chai', 'chaye', 'tea powder', 'chai patti'],
  ['coffee', 'kaapi', 'espresso', 'nescafe', 'bru', 'cold coffee'],
  ['juice', 'cold drink', 'sharbat', 'soda'],

  // Snacks & Quick Food
  ['noodles', 'maggi', 'yippee', 'ramen', 'instant noodles'],
  ['chips', 'crisps', 'wafers', 'kurkure', 'lays', 'potato chips'],
  ['biscuits', 'biscuit', 'cookies', 'rusk'],
  ['peanuts', 'mungfali', 'singdana', 'groundnut'],
  ['makhana', 'fox nuts', 'lotus seeds'],
  ['chocolate', 'chocolates', 'mithai', 'sweet'],

  // Household & Personal
  ['soap', 'sabun', 'body wash', 'dettol', 'dove'],
  ['shampoo', 'hair wash'],
  ['detergent', 'surf', 'washing powder', 'tide', 'ariel'],
  ['toothpaste', 'colgate', 'brush'],
];

// Inverted lookup map for O(1) synonym retrieval
const ALIAS_MAP = new Map();

for (const group of ALIAS_GROUPS) {
  for (const term of group) {
    const key = term.toLowerCase().trim();
    if (!ALIAS_MAP.has(key)) {
      ALIAS_MAP.set(key, new Set());
    }
    for (const peer of group) {
      if (peer !== key) {
        ALIAS_MAP.get(key).add(peer);
      }
    }
  }
}

/**
 * Expands a search query into its constituent tokens plus all synonyms
 * @param {string} rawQuery
 * @returns {string[]} array of unique terms to match
 */
function expandSearchTerms(rawQuery) {
  if (!rawQuery || typeof rawQuery !== 'string') return [];

  const cleaned = rawQuery.trim().toLowerCase();
  if (!cleaned) return [];

  const results = new Set([cleaned]);

  // Exact phrase alias match
  if (ALIAS_MAP.has(cleaned)) {
    for (const syn of ALIAS_MAP.get(cleaned)) {
      results.add(syn);
    }
  }

  // Token-level alias match
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    results.add(token);
    if (ALIAS_MAP.has(token)) {
      for (const syn of ALIAS_MAP.get(token)) {
        results.add(syn);
      }
    }
  }

  return [...results];
}

/**
 * Checks if a product matches the query using Hinglish token expansion
 * @param {object} product
 * @param {string} query
 * @returns {boolean}
 */
function matchesProductHinglish(product, query) {
  if (!query) return true;
  const terms = expandSearchTerms(query);
  const targetText = [
    product.name,
    product.brand,
    product.description,
    ...(product.tags || []),
    product.category?.name || '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return terms.some((term) => targetText.includes(term.toLowerCase()));
}

/**
 * Normalizes voice query tokens, translating regional words to English/Hinglish catalog equivalents
 * @param {string} rawQuery
 * @returns {{ cleanQuery: string, terms: string[] }}
 */
function transliterateVoiceQuery(rawQuery) {
  if (!rawQuery || typeof rawQuery !== 'string') return { cleanQuery: '', terms: [] };
  const cleaned = rawQuery.trim();
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const matchedTokens = [];

  for (const t of tokens) {
    const lower = t.toLowerCase();
    matchedTokens.push(lower);
    if (ALIAS_MAP.has(lower)) {
      const syns = [...ALIAS_MAP.get(lower)];
      if (syns.length > 0) {
        matchedTokens.push(syns[0]); // Primary canonical synonym (e.g., 'milk', 'potato')
      }
    }
  }

  const unique = [...new Set(matchedTokens)];
  return {
    raw: cleaned,
    cleanQuery: unique.join(' '),
    terms: unique,
  };
}

module.exports = {
  expandSearchTerms,
  matchesProductHinglish,
  transliterateVoiceQuery,
};

/**
 * Hinglish & Colloquial Indian Grocery Search Dictionary
 * Maps common vernacular terms (Hindi, Hinglish, Marathi, Kannada, Tamil phonetic terms)
 * to English catalog equivalents and vice-versa.
 */

const ALIAS_GROUPS = [
  // Dairy & Morning
  ['milk', 'doodh', 'dudh', 'paal', 'haalu', 'dairy', 'toned milk', 'cow milk'],
  ['curd', 'dahi', 'mosaru', 'tayir', 'yogurt', 'greek yogurt'],
  ['paneer', 'cottage cheese', 'chenna'],
  ['butter', 'makhan', 'benne', 'vennai'],
  ['ghee', 'neyyi', 'tup', 'clarified butter'],
  ['cheese', 'cheddar', 'mozzarella'],
  ['egg', 'eggs', 'anda', 'ande', 'muttai', 'motte'],
  ['bread', 'pav', 'loaf', 'bun', 'toast'],

  // Vegetables
  ['potato', 'potatoes', 'aloo', 'alu', 'batata', 'urulaikizhangu', 'alugadde'],
  ['onion', 'onions', 'pyaaz', 'pyaz', 'kanda', 'vengayam', 'eerulli'],
  ['tomato', 'tomatoes', 'tamatar', 'tomatar', 'thakkali'],
  ['ginger', 'adrak', 'inji', 'shunti'],
  ['garlic', 'lahsun', 'lasun', 'poondu', 'bellulli'],
  ['chilli', 'chili', 'mirchi', 'mirch', 'hari mirch', 'green chilli', 'milagai'],
  ['coriander', 'dhaniya', 'dhania', 'kothmir', 'kothamalli', 'kothambari'],
  ['spinach', 'palak', 'keerai', 'soppu'],
  ['cucumber', 'kheera', 'kakdi', 'vellarikka', 'southekai'],
  ['lemon', 'nimbu', 'neebu', 'elumichai', 'nimbe'],
  ['capsicum', 'shimla mirch', 'bell pepper'],
  ['cauliflower', 'gobhi', 'phool gobhi'],
  ['cabbage', 'patta gobhi', 'band gobhi'],
  ['carrot', 'gajar', 'gajjari'],
  ['peas', 'matar', 'muttar', 'batani'],
  ['ladyfinger', 'bhindi', 'okra', 'vendakkai'],

  // Fruits
  ['banana', 'bananas', 'kela', 'kele', 'vazhaipazham', 'bale hannu'],
  ['apple', 'apples', 'seb', 'aappil'],
  ['mango', 'mangoes', 'aam', 'manga'],
  ['orange', 'santhe', 'santra', 'narangi'],
  ['coconut', 'nariyal', 'thekai', 'thengai', 'tender coconut'],
  ['watermelon', 'tarbooj', 'kalingad'],
  ['papaya', 'papita'],

  // Staples & Kitchen
  ['rice', 'chawal', 'basmati', 'arisi', 'akki'],
  ['wheat', 'flour', 'atta', 'gehun', 'gothumai', 'godhi'],
  ['maida', 'all purpose flour', 'refined flour'],
  ['besan', 'gram flour', 'chickpea flour'],
  ['dal', 'daal', 'lentils', 'paruppu', 'bele'],
  ['toor dal', 'arhar', 'thuvaram'],
  ['moong dal', 'mung', 'pasi paruppu'],
  ['chana dal', 'chana', 'chole', 'kadalai'],
  ['urad dal', 'ulundhu', 'uddina bele'],
  ['sugar', 'chini', 'cheeni', 'shakar', 'sakkarai'],
  ['salt', 'namak', 'uppu'],
  ['oil', 'tel', 'cooking oil', 'sunflower', 'mustard oil', 'sarson'],
  ['mustard', 'rai', 'sarson', 'kadugu'],
  ['cumin', 'jeera', 'seeragam'],
  ['turmeric', 'haldi', 'manjal'],

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

module.exports = {
  expandSearchTerms,
  matchesProductHinglish,
};

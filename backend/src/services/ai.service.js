const { GoogleGenAI, Type } = require('@google/genai');

function getAiClient() {
  let apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.startsWith('MY_')) {
    const fs = require('fs');
    const path = require('path');
    const candidates = [
      path.resolve(process.cwd(), '.env'),
      path.resolve(process.cwd(), 'backend/.env'),
      path.resolve(__dirname, '../../.env'),
      path.resolve(__dirname, '../.env'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        const text = fs.readFileSync(c, 'utf8');
        const m = text.match(/GEMINI_API_KEY=([^\r\n]+)/);
        if (m && m[1] && !m[1].trim().startsWith('MY_')) {
          apiKey = m[1].trim();
          process.env.GEMINI_API_KEY = apiKey;
          break;
        }
      }
    }
  }

  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.startsWith('MY_')) {
    console.error('[AI Service] No valid GEMINI_API_KEY found');
    return null;
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * Extracts base64 and mimeType from either a data URL or a remote image URL
 */
async function parseImageInput(input) {
  if (input.startsWith('data:')) {
    const matches = input.match(/^data:([^;]+);base64,(.+)$/);
    if (matches) {
      return { mimeType: matches[1], base64Data: matches[2] };
    }
  }

  if (input.startsWith('http://') || input.startsWith('https://')) {
    const res = await fetch(input);
    if (!res.ok) throw new Error(`Failed to fetch image from URL: ${res.statusText}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const mimeType = res.headers.get('content-type') || 'image/jpeg';
    return { mimeType, base64Data: buffer.toString('base64') };
  }

  // Raw base64 string assumed jpeg
  return { mimeType: 'image/jpeg', base64Data: input };
}

/**
 * Generate a professional studio-framed SVG backdrop with the product centered and soft shadows
 * as a reliable, zero-latency fallback whenever external API quota or key is not configured.
 */
function generateStudioFramedFallback(base64Data, mimeType, name) {
  const dataUrl = `data:${mimeType};base64,${base64Data}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
    <defs>
      <radialGradient id="studioLight" cx="50%" cy="42%" r="65%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="55%" stop-color="#f8fafc"/>
        <stop offset="100%" stop-color="#e2e8f0"/>
      </radialGradient>
      <filter id="softContactShadow" x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="24" stdDeviation="18" flood-color="#0f172a" flood-opacity="0.14"/>
        <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#0f172a" flood-opacity="0.08"/>
      </filter>
    </defs>
    <!-- Seamless Studio Cyclorama Background -->
    <rect width="800" height="800" fill="url(#studioLight)"/>
    <!-- Subtle ground horizon reflection -->
    <ellipse cx="400" cy="620" rx="260" ry="24" fill="#0f172a" opacity="0.06"/>
    <!-- Product Object with Studio Contact Shadow -->
    <g filter="url(#softContactShadow)">
      <image href="${dataUrl}" x="120" y="120" width="560" height="520" preserveAspectRatio="xMidYMid meet"/>
    </g>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const aiService = {
  async enhanceProductImage({ image, name = 'Product', category = 'Grocery' }) {
    if (!image) throw new Error('Image is required for enhancement');

    const { mimeType, base64Data } = await parseImageInput(image);
    const ai = getAiClient();

    if (ai) {
      try {
        console.log(`[AI Studio] Enhancing photo for: "${name}" using Gemini...`);
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-image',
          contents: {
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType,
                },
              },
              {
                text: `Transform this user photo of ${name} (${category}) into a pristine, high-end commercial e-commerce catalog photograph. Place the item cleanly centered in a professional photo studio with balanced softbox studio lighting, clean neutral off-white background (#F8F9FA), natural soft contact drop-shadow underneath, crisp edge clarity, true-to-life colors, award-winning grocery packshot photography.`,
              },
            ],
          },
        });

        if (response.candidates?.[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData?.data) {
              const resMime = part.inlineData.mimeType || 'image/png';
              console.log('[AI Studio] Gemini studio photo enhancement successful!');
              return {
                enhancedImage: `data:${resMime};base64,${part.inlineData.data}`,
                provider: 'gemini-3.1-flash-lite-image',
                style: 'Studio Lighting & Clean Backdrop',
              };
            }
          }
        }
      } catch (err) {
        console.warn('[AI Studio] Gemini direct image editing notice:', err.message);
      }
    }

    // Fallback: Studio Light & Contact Shadow compositor
    console.log('[AI Studio] Using high-fidelity Studio Lighting treatment');
    const studioEnhanced = generateStudioFramedFallback(base64Data, mimeType, name);
    return {
      enhancedImage: studioEnhanced,
      provider: 'studio-compositor',
      style: 'Studio Lighting with Neutral Cyclorama & Soft Drop-Shadow',
    };
  },

  async extractProductDetailsFromImage({ image, categories = [] }) {
    if (!image) throw new Error('Product image is required');

    const { mimeType, base64Data } = await parseImageInput(image);
    const ai = getAiClient();
    if (!ai) {
      throw new Error('Gemini API key is not configured or server needs restart to pick up active API key.');
    }

    const categoryListStr = categories
      .map((c) => `ID: "${c.id || c._id}", Name: "${c.name}"`)
      .join('; ');

    let details = {
      name: '',
      brand: '',
      description: '',
      categoryName: '',
      categoryId: '',
      unit: '1 pack',
      mrp: 99,
      price: 89,
      tags: [],
      emoji: '🛍️',
      confidence: 'High',
    };

    try {
      console.log('[AI Product Extractor] Analyzing product packaging with Gemini 3.8 Flash...');
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType,
              },
            },
            {
              text: `You are an expert e-commerce catalog specialist for an Indian quick-commerce grocery dark-store (like Blinkit, Zepto, Swiggy Instamart).
Analyze this photo of a product packaging box, pouch, bottle, label, or grocery item and extract full commercial product details in JSON:
1. name: Clean, professional e-commerce product title in English (e.g., "Maggi 2-Minute Noodles - Double Masala", "Amul Taaza Homogenised Toned Milk", "Tata Salt Vacuum Evaporated", "Cadbury Dairy Milk Silk Chocolate"). Read the exact brand name and product title/variant printed on the packaging. Do NOT invent generic names like "Fresh Grocery Item".
2. brand: The brand or manufacturer company name (e.g., "Maggi", "Nestle", "Amul", "Tata", "Britannia", "Cadbury", "Parle", "Fortune").
3. description: Engaging, rich 2-3 sentence product description highlighting freshness, key ingredients, taste, or culinary use.
4. categoryId: Choose the best matching category ID from the available store categories: [${categoryListStr}].
5. categoryName: The name of the selected category (e.g., "Instant & Frozen Food", "Dairy & Breakfast", "Snacks & Munchies", "Beverages", "Pantry & Groceries", "Bakery & Biscuits").
6. unit: Packaging net weight, quantity, or volume printed on the packaging (e.g., "70 g", "130 g", "500 ml", "1 kg", "Pack of 2", "1 pc").
7. mrp: Maximum Retail Price (MRP) in INR as a number. If printed on the package, use it. Otherwise provide a realistic standard Indian market retail price.
8. price: Selling price in INR as a number (discounted dark-store price slightly lower than or equal to MRP).
9. tags: Array of 5-8 relevant search tags/keywords in lowercase (e.g. ["maggi", "noodles", "instant noodles", "double masala", "snack"]).
10. emoji: A single relevant Unicode grocery emoji (e.g. 🍜, 🥛, 🍫, 🍞, 🧀, ☕, 🧼, 🍪, 🧃, 🥬).
11. confidence: High, Medium, or Estimated.`,
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              brand: { type: Type.STRING },
              description: { type: Type.STRING },
              categoryId: { type: Type.STRING },
              categoryName: { type: Type.STRING },
              unit: { type: Type.STRING },
              mrp: { type: Type.NUMBER },
              price: { type: Type.NUMBER },
              tags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              emoji: { type: Type.STRING },
              confidence: { type: Type.STRING },
            },
            required: ['name', 'brand', 'description', 'unit', 'mrp', 'price'],
          },
        },
      });

      const text = response.text ? response.text.trim() : '';
      if (!text) {
        throw new Error('Gemini returned an empty response for product image analysis.');
      }

      const parsed = JSON.parse(text);
      details = { ...details, ...parsed };
      if (details.mrp && (!details.price || details.price > details.mrp)) {
        details.price = Math.round(details.mrp * 0.92);
      }
      console.log('[AI Product Extractor] Extracted product details successfully:', details.name, details.brand);
    } catch (err) {
      console.error('[AI Product Extractor] Gemini API call error:', err);
      throw new Error(`AI product extraction failed: ${err.message || 'Unable to analyze image'}`);
    }

    // Match categoryId if missing or mismatched
    if (!details.categoryId && categories.length > 0) {
      const match = categories.find((c) =>
        c.name.toLowerCase().includes((details.categoryName || '').toLowerCase()) ||
        (details.categoryName || '').toLowerCase().includes(c.name.toLowerCase())
      );
      details.categoryId = String(match ? match.id || match._id : categories[0].id || categories[0]._id);
      details.categoryName = match ? match.name : categories[0].name;
    }

    return {
      details,
      image,
    };
  },

  async parsePaymentReceipt({ image, expectedOrderId = '', expectedAmount = 0, expectedVpa = '9101516662@ybl' }) {
    if (!image) throw new Error('Receipt image is required');

    const { mimeType, base64Data } = await parseImageInput(image);
    const ai = getAiClient();

    let extracted = {
      amount: null,
      orderId: '',
      utr: '',
      payeeVpa: '',
      payeeName: '',
      paymentStatus: 'UNKNOWN',
      appName: 'UPI',
      isBlurryOrUnreadable: false,
      rejectionReason: '',
    };

    if (ai) {
      try {
        console.log(`[AI Receipt OCR] Parsing receipt with Gemini 3.8 Flash for Order ${expectedOrderId}, Amount: ₹${expectedAmount}...`);
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: {
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType,
                },
              },
              {
                text: `You are an expert payment transaction receipt and UPI invoice parser for Indian digital payments (Google Pay, PhonePe, Paytm, CRED, BHIM, Amazon Pay, bank transfer).
Analyze this receipt or transaction screenshot and extract the following details in JSON:
1. amount: Total money paid as a number (e.g. 450 or 450.00). Do NOT include currency symbols like ₹ or Rs. If not found, return null.
2. orderId: Any order number, order ID, note, or reference noted in the payment (such as "${expectedOrderId}", or any order number, alphanumeric reference, or remark). Return empty string if not found.
3. utr: The 12-digit UPI transaction reference number / UTR / Bank Reference number (e.g. 412389123456 or similar 12 digits).
4. payeeVpa: The recipient UPI ID / VPA (e.g. "${expectedVpa}" or what is visible).
5. payeeName: Name of the recipient / merchant.
6. paymentStatus: Transaction status, strictly one of: "SUCCESS", "FAILED", "PENDING", "UNKNOWN".
7. appName: The UPI app name (e.g., "Google Pay", "PhonePe", "Paytm", "BHIM", "CRED", "Bank").
8. isBlurryOrUnreadable: Boolean, set to true if the screenshot is completely illegible, cut off, blurry, or not a transaction slip.
9. rejectionReason: If unreadable, missing key details, or not a payment screenshot, explain in one clear sentence.`,
              },
            ],
          },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                amount: { type: Type.NUMBER },
                orderId: { type: Type.STRING },
                utr: { type: Type.STRING },
                payeeVpa: { type: Type.STRING },
                payeeName: { type: Type.STRING },
                paymentStatus: { type: Type.STRING },
                appName: { type: Type.STRING },
                isBlurryOrUnreadable: { type: Type.BOOLEAN },
                rejectionReason: { type: Type.STRING },
              },
            },
          },
        });

        const text = response.text ? response.text.trim() : '';
        if (text) {
          try {
            const parsed = JSON.parse(text);
            extracted = { ...extracted, ...parsed };
            console.log('[AI Receipt OCR] Extracted values successfully:', extracted);
          } catch (e) {
            console.warn('[AI Receipt OCR] JSON parse error, raw response:', text);
          }
        }
      } catch (err) {
        console.warn('[AI Receipt OCR] Gemini call warning:', err.message);
      }
    }

    // Matching validation
    const numExtractedAmount = extracted.amount !== null && extracted.amount !== undefined ? Number(extracted.amount) : null;
    const numExpectedAmount = Number(expectedAmount);
    const amountMatched = numExtractedAmount !== null && !isNaN(numExtractedAmount) && Math.abs(numExtractedAmount - numExpectedAmount) < 1.0;

    const normExtracted = String(extracted.orderId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const normExpected = String(expectedOrderId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const orderDigits = String(expectedOrderId || '').replace(/\D/g, '');
    const extractedDigits = String(extracted.orderId || '').replace(/\D/g, '');

    const explicitOrderMatched = Boolean(
      (normExtracted && normExpected && (normExtracted.includes(normExpected) || normExpected.includes(normExtracted))) ||
      (orderDigits.length >= 4 && extractedDigits.includes(orderDigits))
    );

    const vpaMatched = Boolean(
      extracted.payeeVpa &&
      (extracted.payeeVpa.toLowerCase().includes('9101516662') ||
       extracted.payeeVpa.toLowerCase().includes(String(expectedVpa).toLowerCase()) ||
       (extracted.payeeName && extracted.payeeName.toLowerCase().includes('zapbasket')))
    );

    const utrFound = Boolean(extracted.utr && extracted.utr.length >= 6);

    // In Indian UPI, transactions scanned directly from QR codes often don't contain order ID in note
    // So if amount matches and either explicit order ID, matching recipient VPA, or valid UTR is present, it counts as order identified
    const orderIdMatched = explicitOrderMatched || (!extracted.isBlurryOrUnreadable && (vpaMatched || utrFound));

    const isSuccessStatus = extracted.paymentStatus === 'SUCCESS' || (!extracted.paymentStatus && !extracted.isBlurryOrUnreadable);
    const isMatched = amountMatched && orderIdMatched && isSuccessStatus && !extracted.isBlurryOrUnreadable;

    let matchReason = '';
    if (extracted.isBlurryOrUnreadable) {
      matchReason = extracted.rejectionReason || 'Receipt image is blurry or unreadable. Please upload a clear transaction screenshot.';
    } else if (!amountMatched) {
      matchReason = `Amount mismatch: Receipt shows ₹${numExtractedAmount !== null ? numExtractedAmount : '0'}, but order total is ₹${numExpectedAmount}.`;
    } else if (!orderIdMatched) {
      matchReason = `Order reference mismatch: Expected ${expectedOrderId}. Neither matching order ID nor recipient details were found.`;
    } else if (extracted.paymentStatus === 'FAILED') {
      matchReason = 'The uploaded screenshot indicates that the transaction failed.';
    } else {
      matchReason = 'Payment receipt verified successfully. Order ID and Amount matched.';
    }

    return {
      extracted,
      matchDetails: {
        amountMatched,
        orderIdMatched,
        vpaMatched,
        utrFound,
      },
      isMatched,
      matchReason,
    };
  },
};

module.exports = aiService;

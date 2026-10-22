const { GoogleGenAI, Type } = require('@google/genai');
const orderRepository = require('../repositories/order.repository');
const notificationService = require('./notification.service');
const { presentOrder } = require('../utils/presenters');
const ApiError = require('../utils/ApiError');

function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
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

  return { mimeType: 'image/jpeg', base64Data: input };
}

function ownerId(order) {
  return String(order.user?._id || order.user);
}

/**
 * Compares extracted OCR fields against the database order record
 * Enforces fractional rounding tolerance for amount (|extracted - expected| < 1.0)
 */
function matchReceiptToOrder(extracted, order) {
  const expectedAmount = Number(order.total);
  const numExtractedAmount = extracted.amount !== null && extracted.amount !== undefined ? Number(extracted.amount) : null;
  
  // Amount match with fractional rounding tolerance
  const amountMatched = numExtractedAmount !== null && !isNaN(numExtractedAmount) && Math.abs(numExtractedAmount - expectedAmount) < 1.0;

  // Order reference matching
  const expectedOrderId = String(order.orderNumber || '');
  const normExtracted = String(extracted.orderId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const normExpected = expectedOrderId.toLowerCase().replace(/[^a-z0-9]/g, '');
  const orderDigits = expectedOrderId.replace(/\D/g, '');
  const extractedDigits = String(extracted.orderId || '').replace(/\D/g, '');

  const explicitOrderMatched = Boolean(
    (normExtracted && normExpected && (normExtracted.includes(normExpected) || normExpected.includes(normExtracted))) ||
    (orderDigits.length >= 4 && extractedDigits.includes(orderDigits))
  );

  const expectedVpa = String(order.upiId || '9101516662@ybl').toLowerCase();
  const vpaMatched = Boolean(
    extracted.payeeVpa &&
    (extracted.payeeVpa.toLowerCase().includes('9101516662') ||
     extracted.payeeVpa.toLowerCase().includes(expectedVpa) ||
     (extracted.payeeName && extracted.payeeName.toLowerCase().includes('zapbasket')))
  );

  const utrFound = Boolean(extracted.utr && extracted.utr.length >= 6);

  // In Indian UPI, transactions scanned directly from QR codes often don't contain order ID in note
  // If amount matches and either explicit order ID, matching recipient VPA, or valid UTR is present, order is identified
  const orderIdMatched = explicitOrderMatched || (!extracted.isBlurryOrUnreadable && (vpaMatched || utrFound));

  const isSuccessStatus = extracted.paymentStatus === 'SUCCESS' || (!extracted.paymentStatus && !extracted.isBlurryOrUnreadable);
  const isMatched = amountMatched && orderIdMatched && isSuccessStatus && !extracted.isBlurryOrUnreadable;

  let matchReason = '';
  if (extracted.isBlurryOrUnreadable) {
    matchReason = extracted.rejectionReason || 'Receipt image is blurry or unreadable. Please upload a clear transaction screenshot.';
  } else if (!amountMatched) {
    matchReason = `Amount mismatch: Receipt shows ₹${numExtractedAmount !== null ? numExtractedAmount : '0'}, but order total is ₹${expectedAmount}.`;
  } else if (!orderIdMatched) {
    matchReason = `Order reference mismatch: Expected ${expectedOrderId}. Neither matching order ID nor recipient details were found.`;
  } else if (extracted.paymentStatus === 'FAILED') {
    matchReason = 'The uploaded screenshot indicates that the transaction failed in the UPI app.';
  } else {
    matchReason = 'Payment receipt verified successfully. Order ID and Amount matched.';
  }

  return {
    amountMatched,
    orderIdMatched,
    vpaMatched,
    utrFound,
    isMatched,
    matchReason,
  };
}

const receiptVerificationService = {
  /**
   * Synchronously processes an uploaded receipt image with Gemini multimodal vision,
   * compares extracted Order ID and Amount against the database record, and persists verification results.
   */
  async verifyReceipt(user, orderId, image) {
    if (!image) throw new ApiError(400, 'Receipt image is required');

    const order = await orderRepository.findById(orderId);
    if (!order) throw new ApiError(404, 'Order not found');

    const isOwner = ownerId(order) === String(user._id);
    const isAdmin = user.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new ApiError(403, 'You do not have permission to verify this order receipt');
    }

    if (order.status === 'cancelled') {
      throw new ApiError(409, 'Cannot verify receipt for a cancelled order');
    }

    const { mimeType, base64Data } = await parseImageInput(image);
    const ai = getAiClient();

    let extracted = {
      amount: null,
      orderId: '',
      utr: '',
      timestamp: '',
      payeeVpa: '',
      payeeName: '',
      paymentStatus: 'UNKNOWN',
      appName: 'UPI',
      isBlurryOrUnreadable: false,
      rejectionReason: '',
    };

    if (ai) {
      try {
        console.log(`[Receipt Verification Service] Calling Gemini 3.8 Flash for Order ${order.orderNumber} (Expected Amount: ₹${order.total})...`);
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
                text: `You are an expert payment transaction receipt and UPI invoice parser for Indian digital payments (Google Pay, PhonePe, Paytm, CRED, BHIM, Amazon Pay, Netbanking).
Analyze this receipt or transaction screenshot and extract the following details in JSON:
1. amount: Total money paid as a number (e.g. 450 or 450.00). Do NOT include currency symbols like ₹ or Rs. If not found, return null.
2. orderId: Any order number, order ID, note, or reference noted in the payment (such as "${order.orderNumber}", or any order number, alphanumeric reference, or remark). Return empty string if not found.
3. utr: The 12-digit UPI transaction reference number / UTR / Bank Reference number (e.g. 412389123456 or 12 digits).
4. timestamp: Transaction date and time string if visible (e.g., "19 Oct 2026, 04:30 PM").
5. payeeVpa: The recipient UPI ID / VPA (e.g. "${order.upiId || '9101516662@ybl'}" or visible recipient VPA).
6. payeeName: Name of the recipient / merchant.
7. paymentStatus: Transaction status, strictly one of: "SUCCESS", "FAILED", "PENDING", "UNKNOWN".
8. appName: The UPI app name (e.g., "Google Pay", "PhonePe", "Paytm", "BHIM", "CRED", "Bank").
9. isBlurryOrUnreadable: Boolean, set to true if the screenshot is completely illegible, cut off, blurry, or not a transaction slip.
10. rejectionReason: If unreadable, missing key details, or not a payment screenshot, explain in one clear sentence.`,
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
                timestamp: { type: Type.STRING },
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
            console.log('[Receipt Verification Service] OCR Extracted values successfully:', extracted);
          } catch (e) {
            console.warn('[Receipt Verification Service] JSON parse error, raw response:', text);
          }
        }
      } catch (err) {
        console.warn('[Receipt Verification Service] Gemini call warning:', err.message);
      }
    }

    // Compare extracted fields against database record
    const matchResult = matchReceiptToOrder(extracted, order);

    if (!order.receiptVerification) {
      order.receiptVerification = {};
    }

    order.receiptVerification.receiptImageUrl = image;
    order.receiptVerification.uploadedAt = new Date();
    order.receiptVerification.extractedAmount = extracted.amount;
    order.receiptVerification.extractedOrderId = extracted.orderId;
    order.receiptVerification.extractedUtr = extracted.utr;
    order.receiptVerification.extractedTimestamp = extracted.timestamp;
    order.receiptVerification.extractedPayeeVpa = extracted.payeeVpa;
    order.receiptVerification.extractedPayeeName = extracted.payeeName;
    order.receiptVerification.extractedStatus = extracted.paymentStatus;
    order.receiptVerification.appName = extracted.appName;
    order.receiptVerification.isMatched = matchResult.isMatched;
    order.receiptVerification.matchReason = matchResult.matchReason;
    order.receiptVerification.matchDetails = {
      amountMatched: matchResult.amountMatched,
      orderIdMatched: matchResult.orderIdMatched,
      vpaMatched: matchResult.vpaMatched,
      utrFound: matchResult.utrFound,
    };

    if (matchResult.isMatched) {
      order.receiptVerification.verificationStatus = 'verified';
      order.paymentStatus = 'paid';
      if (extracted.utr) {
        order.upiTransactionId = extracted.utr;
      }
      if (extracted.appName) {
        order.upiApp = extracted.appName;
      }

      order.timeline.push({
        status: order.status,
        note: `Receipt verified by AI (Matched Order #${order.orderNumber}, ₹${order.total}, UTR: ${extracted.utr || 'Extracted'}). Pending admin review.`,
        at: new Date(),
        by: user._id,
      });

      await notificationService.create({
        user: ownerId(order),
        title: 'Payment Receipt Verified',
        body: `Your payment receipt for order ${order.orderNumber} (₹${order.total}) has been verified automatically. Pending store manager review.`,
        type: 'order',
        link: `/orders/${order._id}`,
      });
    } else {
      order.receiptVerification.verificationStatus = 'mismatched';
      order.timeline.push({
        status: order.status,
        note: `Receipt upload mismatch: ${matchResult.matchReason}`,
        at: new Date(),
        by: user._id,
      });
    }

    await orderRepository.save(order);
    const fresh = await orderRepository.findById(order._id);

    return {
      success: true,
      isMatched: matchResult.isMatched,
      matchReason: matchResult.matchReason,
      extracted,
      matchDetails: order.receiptVerification.matchDetails,
      order: presentOrder(fresh, user.role),
    };
  },

  /**
   * Allows customer to submit a 12-digit UTR reference manually if image was blurry or mismatched
   */
  async submitManualUtr(user, orderId, utr, note = '') {
    const order = await orderRepository.findById(orderId);
    if (!order) throw new ApiError(404, 'Order not found');

    const isOwner = ownerId(order) === String(user._id);
    const isAdmin = user.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new ApiError(403, 'You do not have permission to update this order');
    }

    if (!order.receiptVerification) {
      order.receiptVerification = {};
    }

    order.receiptVerification.manualUtr = utr;
    order.receiptVerification.verificationStatus = 'manual_utr_submitted';
    order.upiTransactionId = utr;

    order.timeline.push({
      status: order.status,
      note: `Customer submitted manual UTR reference: ${utr}${note ? ` (${note})` : ''}. Pending admin review.`,
      at: new Date(),
      by: user._id,
    });

    await orderRepository.save(order);
    const fresh = await orderRepository.findById(order._id);

    return {
      success: true,
      message: 'Manual UTR reference submitted for admin verification.',
      order: presentOrder(fresh, user.role),
    };
  },

  /**
   * Admin approves or rejects the uploaded payment receipt
   */
  async adminReviewReceipt(adminUser, orderId, decision, note = '') {
    const order = await orderRepository.findById(orderId);
    if (!order) throw new ApiError(404, 'Order not found');

    if (!order.receiptVerification) {
      order.receiptVerification = {};
    }

    order.receiptVerification.reviewedAt = new Date();
    order.receiptVerification.reviewedBy = adminUser._id;
    order.receiptVerification.adminReviewNote = note;

    if (decision === 'approve') {
      order.receiptVerification.verificationStatus = 'admin_approved';
      order.paymentStatus = 'paid';

      if (order.status === 'placed') {
        order.status = 'confirmed';
        order.timeline.push({
          status: 'confirmed',
          note: note || 'Payment receipt approved by store manager. Order confirmed.',
          at: new Date(),
          by: adminUser._id,
        });
      } else {
        order.timeline.push({
          status: order.status,
          note: note || 'Payment receipt approved by store manager.',
          at: new Date(),
          by: adminUser._id,
        });
      }

      await notificationService.create({
        user: ownerId(order),
        title: 'Payment Approved & Order Confirmed',
        body: `Store manager approved your payment for ${order.orderNumber}. Order is being prepared!`,
        type: 'order',
        link: `/orders/${order._id}`,
      });
    } else {
      order.receiptVerification.verificationStatus = 'admin_rejected';
      order.timeline.push({
        status: order.status,
        note: `Receipt rejected by admin: ${note || 'Invalid payment slip'}. Customer requested to re-upload.`,
        at: new Date(),
        by: adminUser._id,
      });

      await notificationService.create({
        user: ownerId(order),
        title: 'Receipt Verification Update',
        body: `Your receipt for ${order.orderNumber} requires attention: ${note || 'Please re-upload a clear screenshot'}.`,
        type: 'order',
        link: `/orders/${order._id}`,
      });
    }

    await orderRepository.save(order);
    const fresh = await orderRepository.findById(order._id);
    return presentOrder(fresh, 'admin');
  },
};

module.exports = receiptVerificationService;

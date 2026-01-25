import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
// Note: Install tesseract.js: npm install tesseract.js
// For now, using a simplified version - you can enhance with actual OCR later

interface OCRResult {
  amount: number | null;
  cardLastDigits: string | null;
  paymentDate: Date | null;
  success: boolean;
  extractedText: string;
}

@Injectable()
export class OCRService {
  /**
   * Extract payment information from screenshot using OCR
   */
  async extractPaymentInfo(imagePath: string, expectedAmount: number): Promise<OCRResult> {
    try {
      let extractedText = '';
      
      // Try to use Tesseract.js if available
      try {
        const { createWorker } = require('tesseract.js');
        const imageBuffer = fs.readFileSync(imagePath);
        const worker = await createWorker('eng+rus');
        const { data: { text } } = await worker.recognize(imageBuffer);
        await worker.terminate();
        extractedText = text.toLowerCase();
        console.log('OCR extracted text:', extractedText);
      } catch (ocrError) {
        console.warn('Tesseract.js not available, using manual review:', ocrError.message);
        // If Tesseract is not installed, return result requiring manual review
        return {
          amount: null,
          cardLastDigits: null,
          paymentDate: null,
          success: false,
          extractedText: '',
        };
      }

      // Extract information from OCR text
      const amount = this.extractAmount(extractedText, expectedAmount);
      const cardLastDigits = this.extractCardDigits(extractedText);
      const paymentDate = this.extractDate(extractedText);

      // Verify payment - amount must match (with 10% tolerance)
      const success = amount !== null && amount >= expectedAmount * 0.9 && amount <= expectedAmount * 1.1;

      return {
        amount,
        cardLastDigits,
        paymentDate,
        success,
        extractedText,
      };
    } catch (error) {
      console.error('OCR Error:', error);
      return {
        amount: null,
        cardLastDigits: null,
        paymentDate: null,
        success: false,
        extractedText: '',
      };
    }
  }

  /**
   * Extract amount from OCR text
   */
  private extractAmount(text: string, expectedAmount: number): number | null {
    // Look for patterns like "10000", "10 000", "10,000", "10000 UZS", etc.
    const amountPatterns = [
      /(\d{1,3}(?:\s?\d{3})*(?:\.\d{2})?)\s*(?:uzs|so'm|sum|руб|₽)/i,
      /(?:amount|summa|сумма|to'lov|платёж)[\s:]*(\d{1,3}(?:\s?\d{3})*(?:\.\d{2})?)/i,
      /(\d{4,})/g, // Any 4+ digit number
    ];

    for (const pattern of amountPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        const amountStr = matches[1] || matches[0];
        const amount = parseFloat(amountStr.replace(/\s/g, '').replace(/,/g, ''));
        if (amount && amount >= expectedAmount * 0.9 && amount <= expectedAmount * 1.1) {
          return Math.round(amount);
        }
      }
    }

    // If no pattern matches, check if expected amount appears in text
    const expectedStr = expectedAmount.toString();
    if (text.includes(expectedStr) || text.includes(expectedStr.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1 '))) {
      return expectedAmount;
    }

    return null;
  }

  /**
   * Extract card last 4 digits from OCR text
   */
  private extractCardDigits(text: string): string | null {
    // Look for patterns like "****1234", "1234", "card ending in 1234", etc.
    const cardPatterns = [
      /\*{2,4}(\d{4})/i,
      /(?:card|karta|карта)[\s:]*(?:ending|ending\s*in|номер)[\s:]*(\d{4})/i,
      /(\d{4})(?:\s|$)/g,
    ];

    for (const pattern of cardPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        const digits = matches[1] || matches[0];
        if (digits && /^\d{4}$/.test(digits)) {
          return digits;
        }
      }
    }

    return null;
  }

  /**
   * Extract payment date from OCR text
   */
  private extractDate(text: string): Date | null {
    // Look for date patterns like "21.01.2026", "2026-01-21", "21/01/2026", etc.
    const datePatterns = [
      /(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/,
      /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/,
      /(?:date|sana|дата)[\s:]*(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/i,
    ];

    for (const pattern of datePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        try {
          let day, month, year;
          if (matches[3] && matches[3].length === 4) {
            // Format: DD.MM.YYYY or YYYY-MM-DD
            if (matches[0].includes('-')) {
              year = parseInt(matches[1]);
              month = parseInt(matches[2]);
              day = parseInt(matches[3]);
            } else {
              day = parseInt(matches[1]);
              month = parseInt(matches[2]);
              year = parseInt(matches[3]);
            }
          } else {
            continue;
          }

          const date = new Date(year, month - 1, day);
          if (date.getTime() && date <= new Date()) {
            return date;
          }
        } catch (e) {
          continue;
        }
      }
    }

    return null;
  }
}

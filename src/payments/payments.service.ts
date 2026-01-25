import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as path from 'path';
import { Payment } from './payment.entity';
import { Subscription } from './subscription.entity';
import { AttemptAccess } from './attempt-access.entity';
import { User } from '../users/user.entity';
import { OCRService } from './ocr.service';

@Injectable()
export class PaymentsService {
  private readonly clickMerchantId: string;
  private readonly clickServiceId: string;
  private readonly clickSecretKey: string;
  private readonly clickMerchantUserId: string;

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(AttemptAccess)
    private readonly attemptAccessRepo: Repository<AttemptAccess>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly configService: ConfigService,
    private readonly ocrService: OCRService,
  ) {
    // Get Click credentials from environment
    this.clickMerchantId = this.configService.get<string>('CLICK_MERCHANT_ID') || '';
    this.clickServiceId = this.configService.get<string>('CLICK_SERVICE_ID') || '';
    this.clickSecretKey = this.configService.get<string>('CLICK_SECRET_KEY') || '';
    this.clickMerchantUserId = this.configService.get<string>('CLICK_MERCHANT_USER_ID') || '';
  }

  async createClickPayment(
    userId: string,
    body: { amount?: number; description?: string },
  ) {
    // User can specify amount or use default top-up amounts
    let amount = body.amount || 10000; // Default: 10,000 UZS minimum top-up
    
    // Validate minimum amount
    if (amount < 10000) {
      throw new BadRequestException('Minimum top-up amount is 10,000 UZS');
    }

    // Create payment record (balance top-up)
    const payment = this.paymentRepo.create({
      user: { id: userId } as any,
      provider: 'click',
      type: 'balance_topup', // Changed to balance top-up
      amount,
      currency: 'UZS',
      planCode: null,
      examId: null,
      status: 'pending',
    });
    const saved = await this.paymentRepo.save(payment);

    // Generate Click payment URL
    // Click payment URL format: https://my.click.uz/services/pay?service_id=...&merchant_id=...&amount=...&transaction_param=...
    const merchantTransId = saved.id;
    const amountInTiyin = Math.round(amount * 100); // Convert to tiyin (1 UZS = 100 tiyin)

    // Build Click payment URL
    const clickUrl = `https://my.click.uz/services/pay?service_id=${this.clickServiceId}&merchant_id=${this.clickMerchantId}&amount=${amountInTiyin}&transaction_param=${merchantTransId}&return_url=${encodeURIComponent(this.configService.get<string>('CLICK_RETURN_URL') || 'http://localhost:3000/payment/success')}`;

    return {
      paymentId: saved.id,
      amount: saved.amount,
      currency: saved.currency,
      provider: 'click',
      clickUrl,
    };
  }

  private generateClickSignString(payload: any): string {
    // Click signature format: md5(click_trans_id + merchant_trans_id + merchant_prepare_id + amount + action + sign_time + secret_key)
    const signString = [
      payload.click_trans_id || '',
      payload.merchant_trans_id || '',
      payload.merchant_prepare_id || '',
      payload.amount || '',
      payload.action || '',
      payload.sign_time || '',
      this.clickSecretKey,
    ].join('');
    return crypto.createHash('md5').update(signString).digest('hex');
  }

  async handleClickPrepare(payload: any) {
    // Validate signature
    const receivedSign = payload.sign_string || payload.sign;
    const calculatedSign = this.generateClickSignString(payload);

    if (receivedSign !== calculatedSign) {
      return {
        error: -1,
        error_note: 'Invalid signature',
      };
    }

    // Find payment
    const paymentId = payload.merchant_trans_id;
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId },
      relations: ['user'],
    });

    if (!payment) {
      return {
        error: -4,
        error_note: 'Payment not found',
      };
    }

    if (payment.status !== 'pending') {
      return {
        error: -4,
        error_note: 'Payment already processed',
      };
    }

    // Validate amount
    const amountInTiyin = Math.round(payment.amount * 100);
    if (parseInt(payload.amount) !== amountInTiyin) {
      return {
        error: -2,
        error_note: 'Invalid amount',
      };
    }

    // Return success
    return {
      error: 0,
      error_note: 'Success',
      click_trans_id: payload.click_trans_id,
      merchant_trans_id: payload.merchant_trans_id,
      merchant_prepare_id: payment.id,
    };
  }

  async handleClickComplete(payload: any) {
    // Validate signature
    const receivedSign = payload.sign_string || payload.sign;
    const calculatedSign = this.generateClickSignString(payload);

    if (receivedSign !== calculatedSign) {
      return {
        error: -1,
        error_note: 'Invalid signature',
      };
    }

    // Find payment
    const paymentId = payload.merchant_trans_id;
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId },
      relations: ['user'],
    });

    if (!payment) {
      return {
        error: -4,
        error_note: 'Payment not found',
      };
    }

    // Check if already processed
    if (payment.status === 'paid') {
      return {
        error: 0,
        error_note: 'Success',
        click_trans_id: payload.click_trans_id,
        merchant_trans_id: payload.merchant_trans_id,
        merchant_confirm_id: payment.clickPaydocId || '1',
      };
    }

    // Update payment status
    payment.status = 'paid';
    payment.providerTransactionId = String(payload.click_trans_id || '');
    payment.clickPaydocId = String(payload.merchant_confirm_id || '1');
    await this.paymentRepo.save(payment);

    // Add money to user's balance
    const user = await this.userRepo.findOne({ where: { id: payment.user.id } });
    if (user) {
      user.balance = (Number(user.balance) || 0) + Number(payment.amount);
      await this.userRepo.save(user);
    }

    return {
      error: 0,
      error_note: 'Success',
      click_trans_id: payload.click_trans_id,
      merchant_trans_id: payload.merchant_trans_id,
      merchant_confirm_id: payment.clickPaydocId || '1',
    };
  }

  // Check if user has enough balance to take an exam (10,000 UZS per exam)
  async hasEnoughBalance(userId: string): Promise<boolean> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return false;
    // PostgreSQL numeric type returns as string, convert to number
    const balance = typeof user.balance === 'string' ? parseFloat(user.balance) : Number(user.balance);
    return (isNaN(balance) ? 0 : balance) >= 10000; // 10,000 UZS per exam
  }

  // Deduct balance when user starts an exam (10,000 UZS)
  async deductBalanceForExam(userId: string): Promise<boolean> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // PostgreSQL numeric type returns as string, convert to number
    const currentBalance = typeof user.balance === 'string' ? parseFloat(user.balance) : Number(user.balance);
    const balance = isNaN(currentBalance) ? 0 : currentBalance;
    const examCost = 10000; // 10,000 UZS per exam

    if (balance < examCost) {
      throw new ForbiddenException(`Insufficient balance. You need ${examCost} UZS to take an exam. Your current balance: ${balance} UZS`);
    }

    user.balance = balance - examCost;
    await this.userRepo.save(user);
    return true;
  }

  // Get user balance
  async getUserBalance(userId: string): Promise<number> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return 0;
    // PostgreSQL numeric type returns as string, convert to number
    const balance = typeof user.balance === 'string' ? parseFloat(user.balance) : Number(user.balance);
    return isNaN(balance) ? 0 : balance;
  }

  // Get user payment history
  async getPaymentHistory(userId: string) {
    const payments = await this.paymentRepo.find({
      where: { user: { id: userId } as any },
      order: { createdAt: 'DESC' },
      take: 50, // Last 50 payments
    });

    return payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      type: p.type,
      createdAt: p.createdAt,
      providerTransactionId: p.providerTransactionId,
    }));
  }

  // Get user's balance and payment info
  async getUserAccessInfo(userId: string) {
    const balance = await this.getUserBalance(userId);
    return {
      balance: Number(balance) || 0,
      hasEnoughBalance: balance >= 10000,
    };
  }

  // Get bank card information for manual payment
  getBankCardInfo() {
    return {
      cardNumber: this.configService.get<string>('BANK_CARD_NUMBER') || '8600 1234 5678 9012',
      cardholder: this.configService.get<string>('BANK_CARDHOLDER') || 'BANDMASTER LLC',
      bankName: this.configService.get<string>('BANK_NAME') || 'Bank Name',
    };
  }

  // Create manual payment with screenshot
  async createManualPayment(userId: string, amount: number, screenshotPath: string, description?: string) {
    // Perform OCR on screenshot
    const ocrResult = await this.ocrService.extractPaymentInfo(screenshotPath, amount);

    // Extract filename from full path and create relative URL
    const filename = path.basename(screenshotPath);
    const screenshotUrl = `/upload/payments/${filename}`;

    // Create payment record
    const payment = this.paymentRepo.create({
      user: { id: userId } as any,
      provider: 'manual',
      type: 'balance_topup',
      amount,
      currency: 'UZS',
      planCode: null,
      examId: null,
      status: ocrResult.success ? 'paid' : 'pending', // Auto-approve if OCR successful
      screenshotUrl, // Store relative path for static serving
      cardLastDigits: ocrResult.cardLastDigits,
      paymentDate: ocrResult.paymentDate,
    });
    const saved = await this.paymentRepo.save(payment);

    // If OCR verification successful, add balance immediately
    if (ocrResult.success) {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (user) {
        user.balance = (Number(user.balance) || 0) + Number(amount);
        await this.userRepo.save(user);
      }
    }

    return {
      paymentId: saved.id,
      amount: saved.amount,
      status: saved.status,
      ocrResult: {
        success: ocrResult.success,
        extractedAmount: ocrResult.amount,
        cardLastDigits: ocrResult.cardLastDigits,
        paymentDate: ocrResult.paymentDate,
        message: ocrResult.success
          ? 'Payment verified automatically. Balance has been added.'
          : 'Payment is pending manual review. We will verify your screenshot and add balance soon.',
      },
    };
  }
}

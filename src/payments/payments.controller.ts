import { Body, Controller, Get, Param, Post, Req, UploadedFile, UseGuards, UseInterceptors, HttpException, HttpStatus } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import * as path from 'path';
import type { Express } from 'express';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // Called from frontend to create a Click payment for balance top-up
  @Post('click/create')
  @UseGuards(JwtAuthGuard)
  createClickPayment(
    @Body()
    body: {
      amount?: number; // Amount to top-up (minimum 10,000 UZS)
      description?: string;
    },
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.paymentsService.createClickPayment(userId, body);
  }

  // CLICK prepare endpoint (called by Click)
  @Post('click/prepare')
  handleClickPrepare(@Body() payload: any) {
    return this.paymentsService.handleClickPrepare(payload);
  }

  // CLICK complete endpoint (called by Click)
  @Post('click/complete')
  handleClickComplete(@Body() payload: any) {
    return this.paymentsService.handleClickComplete(payload);
  }

  // Get user's access info
  @Get('access')
  @UseGuards(JwtAuthGuard)
  getUserAccess(@Req() req: Request) {
    const userId = (req as any).user?.id;
    return this.paymentsService.getUserAccessInfo(userId);
  }

  // Check if user has enough balance
  @Get('check-balance')
  @UseGuards(JwtAuthGuard)
  async checkBalance(@Req() req: Request) {
    const userId = (req as any).user?.id;
    const balance = await this.paymentsService.getUserBalance(userId);
    const hasEnough = await this.paymentsService.hasEnoughBalance(userId);
    return { balance, hasEnough };
  }

  // Deduct balance when starting exam
  @Post('deduct-exam')
  @UseGuards(JwtAuthGuard)
  async deductForExam(@Req() req: Request) {
    const userId = (req as any).user?.id;
    await this.paymentsService.deductBalanceForExam(userId);
    const newBalance = await this.paymentsService.getUserBalance(userId);
    return { success: true, newBalance };
  }

  // Get payment history
  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getPaymentHistory(@Req() req: Request) {
    const userId = (req as any).user?.id;
    return this.paymentsService.getPaymentHistory(userId);
  }

  // Get bank card information for manual payment
  @Get('bank-card')
  getBankCardInfo() {
    return this.paymentsService.getBankCardInfo();
  }

  // Create manual payment (with screenshot)
  @Post('manual/create')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('screenshot', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = path.join(process.cwd(), 'upload', 'payments');
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `payment-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
          cb(null, true);
        } else {
          cb(new HttpException('Only image files are allowed', HttpStatus.BAD_REQUEST), false);
        }
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  async createManualPayment(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const user = (req as any).user;
    console.log('Payment request - user object:', user);
    const userId = user?.id || user?.userId;
    if (!userId) {
      console.error('Payment request - no user ID found. User object:', user);
      throw new HttpException('User not authenticated', HttpStatus.UNAUTHORIZED);
    }

    if (!file) {
      throw new HttpException('Screenshot is required', HttpStatus.BAD_REQUEST);
    }

    // Get form data from req.body (FormData sends data as strings)
    const amount = Number(req.body.amount);
    const description = req.body.description;

    if (!amount || isNaN(amount) || amount < 10000) {
      throw new HttpException('Minimum top-up amount is 10,000 UZS', HttpStatus.BAD_REQUEST);
    }

    return this.paymentsService.createManualPayment(userId, amount, file.path, description);
  }
}


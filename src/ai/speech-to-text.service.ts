import { Injectable, Inject, forwardRef } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { OpenAIService } from './openai.service';

@Injectable()
export class SpeechToTextService {
  constructor(
    @Inject(forwardRef(() => OpenAIService))
    private readonly openAI: OpenAIService,
  ) {}
  /**
   * Audio faylni matnga o'girish (OpenAI Whisper API)
   */
  async transcribeAudio(base64Audio: string, partNumber: number): Promise<string> {
    try {
      if (!base64Audio) {
        return '';
      }

      // OpenAI Whisper API orqali audio faylni matnga o'girish
      const transcript = await this.openAI.transcribeAudio(base64Audio, partNumber);
      return transcript;

    } catch (error) {
      console.error('Error transcribing audio:', error);
      return '';
    }
  }

  /**
   * Audio fayl davomiyligini taxminiy hisoblash
   */
  private estimateAudioDuration(audioSize: number): number {
    // Taxminiy: 1KB = 0.1 sekund (webm format uchun)
    return Math.round((audioSize / 1024) * 0.1);
  }

  /**
   * Audio faylni to'liq matnga o'girish
   * Bu funksiya hozircha ishlamaydi, chunki to'liq speech-to-text uchun maxsus kutubxona kerak
   * Lekin biz oddiy yondashuv ishlatamiz
   */
  async fullTranscribe(audioPath: string): Promise<string> {
    // To'liq speech-to-text uchun quyidagilardan biri kerak:
    // 1. Google Cloud Speech-to-Text API
    // 2. AWS Transcribe
    // 3. Azure Speech Services
    // 4. Mozilla DeepSpeech (offline)
    // 5. Whisper AI (OpenAI)
    
    // Hozircha audio faylni saqlab qo'yamiz
    if (fs.existsSync(audioPath)) {
      return '[Audio fayl mavjud, lekin matnga o\'girish uchun maxsus kutubxona kerak]';
    }
    
    return '';
  }
}

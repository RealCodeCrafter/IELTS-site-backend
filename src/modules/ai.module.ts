import { Module } from '@nestjs/common';
import { AiScoringService } from '../ai/ai-scoring.service';
import { SpeechToTextService } from '../ai/speech-to-text.service';
import { OpenAIService } from '../ai/openai.service';

@Module({
  providers: [AiScoringService, SpeechToTextService, OpenAIService],
  exports: [AiScoringService, SpeechToTextService, OpenAIService],
})
export class AiModule {}






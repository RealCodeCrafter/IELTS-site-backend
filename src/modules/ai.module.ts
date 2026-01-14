import { Module } from '@nestjs/common';
import { AiScoringService } from '../ai/ai-scoring.service';

@Module({
  providers: [AiScoringService],
  exports: [AiScoringService],
})
export class AiModule {}






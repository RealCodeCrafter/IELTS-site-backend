import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

@Injectable()
export class OpenAIService {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly whisperModel: string;
  private readonly apiUrl = 'https://api.openai.com/v1';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('OPENAI_API_KEY') || '';
    this.model = this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o';
    this.whisperModel = this.configService.get<string>('OPENAI_WHISPER_MODEL') || 'whisper-1';
  }

  /**
   * Audio faylni matnga o'girish (Whisper API)
   */
  async transcribeAudio(base64Audio: string, partNumber: number): Promise<string> {
    try {
      if (!this.apiKey) {
        console.warn('⚠️ OpenAI API key topilmadi. Audio faylni matnga o\'girib bo\'lmaydi.');
        return '';
      }

      // Base64 stringni ajratish
      let base64Data = base64Audio;
      if (base64Audio.includes(',')) {
        base64Data = base64Audio.split(',')[1];
      }
      
      if (!base64Data) {
        return '';
      }

      // Audio faylni saqlash
      const audioDir = path.join(process.cwd(), 'upload', 'speaking');
      if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir, { recursive: true });
      }

      const audioFileName = `speaking_part${partNumber}_${Date.now()}.webm`;
      const audioPath = path.join(audioDir, audioFileName);
      
      // Base64 dan buffer yaratish va saqlash
      const audioBuffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(audioPath, audioBuffer);

      // FormData yaratish (Node.js uchun)
      const FormDataModule = require('form-data');
      const formData = new FormDataModule();
      formData.append('file', audioBuffer, {
        filename: audioFileName,
        contentType: 'audio/webm',
      });
      formData.append('model', this.whisperModel);
      formData.append('language', 'en'); // IELTS ingliz tilida

      // OpenAI Whisper API ga so'rov yuborish (axios orqali)
      const response = await axios.post(
        `${this.apiUrl}/audio/transcriptions`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            ...formData.getHeaders(),
          },
        }
      );

      return response.data.text || '';

    } catch (error: any) {
      if (error.response?.data?.error) {
        const apiError = error.response.data.error;
        if (apiError.code === 'insufficient_quota') {
          console.error('❌ OpenAI API quota tugagan. Iltimos, API key ni tekshiring va billing ni to\'ldiring.');
        } else {
          console.error('❌ OpenAI API xatosi:', apiError.message || apiError);
        }
      } else {
        console.error('❌ Error transcribing audio with OpenAI:', error.message || error);
      }
      return '';
    }
  }

  /**
   * Writing ni IELTS standartlariga mos baholash
   */
  async scoreWriting(task1Text: string, task2Text: string, task1Type?: string, task2Type?: string): Promise<{
    task1Score: number;
    task2Score: number;
    overallScore: number;
    task1Feedback: string;
    task2Feedback: string;
  }> {
    try {
      if (!this.apiKey) {
        console.warn('⚠️ OpenAI API key topilmadi. Writing baholanmaydi.');
        return {
          task1Score: 0,
          task2Score: 0,
          overallScore: 0,
          task1Feedback: 'OpenAI API key topilmadi.',
          task2Feedback: 'OpenAI API key topilmadi.',
        };
      }

      const prompt = `You are an IELTS examiner. Evaluate the following IELTS Writing responses according to official IELTS band descriptors (Task Achievement/Response, Coherence and Cohesion, Lexical Resource, Grammatical Range and Accuracy).

Task 1 (${task1Type || 'General'}):
${task1Text || 'No response provided'}

Task 2 (${task2Type || 'Essay'}):
${task2Text || 'No response provided'}

Provide scores for each task (0.0 to 9.0) and detailed feedback in the following JSON format:
{
  "task1": {
    "score": 0.0-9.0,
    "taskAchievement": "feedback",
    "coherence": "feedback",
    "lexicalResource": "feedback",
    "grammar": "feedback",
    "overallFeedback": "detailed feedback"
  },
  "task2": {
    "score": 0.0-9.0,
    "taskResponse": "feedback",
    "coherence": "feedback",
    "lexicalResource": "feedback",
    "grammar": "feedback",
    "overallFeedback": "detailed feedback"
  }
}

Be strict and accurate. Use official IELTS band descriptors.`;

      const response = await axios.post(
        `${this.apiUrl}/chat/completions`,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert IELTS examiner. Always respond with valid JSON only, no additional text.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = response.data;
      const content = result.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);

      const task1Score = parsed.task1?.score || 0;
      const task2Score = parsed.task2?.score || 0;
      const overallScore = task1Text && task2Text 
        ? Number(((task1Score + task2Score * 2) / 3).toFixed(1))
        : (task1Text ? task1Score : task2Score);

      const task1Feedback = task1Text 
        ? `Task Achievement: ${parsed.task1?.taskAchievement || 'N/A'}\nCoherence: ${parsed.task1?.coherence || 'N/A'}\nLexical Resource: ${parsed.task1?.lexicalResource || 'N/A'}\nGrammar: ${parsed.task1?.grammar || 'N/A'}\n\n${parsed.task1?.overallFeedback || ''}`
        : 'Task 1 yozilmagan.';

      const task2Feedback = task2Text
        ? `Task Response: ${parsed.task2?.taskResponse || 'N/A'}\nCoherence: ${parsed.task2?.coherence || 'N/A'}\nLexical Resource: ${parsed.task2?.lexicalResource || 'N/A'}\nGrammar: ${parsed.task2?.grammar || 'N/A'}\n\n${parsed.task2?.overallFeedback || ''}`
        : 'Task 2 yozilmagan.';

      return {
        task1Score: Number(task1Score.toFixed(1)),
        task2Score: Number(task2Score.toFixed(1)),
        overallScore: Number(overallScore.toFixed(1)),
        task1Feedback,
        task2Feedback,
      };

    } catch (error: any) {
      if (error.response?.data?.error) {
        const apiError = error.response.data.error;
        if (apiError.code === 'insufficient_quota') {
          console.error('❌ OpenAI API quota tugagan. Iltimos, API key ni tekshiring va billing ni to\'ldiring.');
        } else {
          console.error('❌ OpenAI API xatosi:', apiError.message || apiError);
        }
      } else {
        console.error('❌ Error scoring writing with AI:', error.message || error);
      }
      return {
        task1Score: 0,
        task2Score: 0,
        overallScore: 0,
        task1Feedback: 'AI baholash xatosi. Iltimos, API key ni tekshiring.',
        task2Feedback: 'AI baholash xatosi. Iltimos, API key ni tekshiring.',
      };
    }
  }

  /**
   * Speaking ni IELTS standartlariga mos baholash
   */
  async scoreSpeaking(transcript: string, partNumber: number, topic?: string): Promise<{
    score: number;
    fluency: string;
    lexicalResource: string;
    grammar: string;
    pronunciation: string;
    overallFeedback: string;
  }> {
    try {
      if (!this.apiKey) {
        console.warn('⚠️ OpenAI API key topilmadi. Speaking baholanmaydi.');
        return {
          score: 0,
          fluency: 'OpenAI API key topilmadi.',
          lexicalResource: 'OpenAI API key topilmadi.',
          grammar: 'OpenAI API key topilmadi.',
          pronunciation: 'OpenAI API key topilmadi.',
          overallFeedback: 'OpenAI API key topilmadi.',
        };
      }

      if (!transcript || transcript.trim().length === 0) {
        return {
          score: 0,
          fluency: 'Transcript yozilmagan.',
          lexicalResource: 'Transcript yozilmagan.',
          grammar: 'Transcript yozilmagan.',
          pronunciation: 'Transcript yozilmagan.',
          overallFeedback: 'Transcript yozilmagan.',
        };
      }

      const prompt = `You are an IELTS examiner. Evaluate the following IELTS Speaking response (Part ${partNumber}) according to official IELTS band descriptors (Fluency and Coherence, Lexical Resource, Grammatical Range and Accuracy, Pronunciation).

Topic: ${topic || 'General topic'}
Transcript:
${transcript}

Provide a score (0.0 to 9.0) and detailed feedback in the following JSON format:
{
  "score": 0.0-9.0,
  "fluency": "detailed feedback on fluency and coherence",
  "lexicalResource": "detailed feedback on vocabulary use",
  "grammar": "detailed feedback on grammatical range and accuracy",
  "pronunciation": "detailed feedback on pronunciation (based on transcript patterns)",
  "overallFeedback": "comprehensive feedback with specific examples and suggestions"
}

Be strict and accurate. Use official IELTS band descriptors.`;

      const response = await axios.post(
        `${this.apiUrl}/chat/completions`,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert IELTS examiner. Always respond with valid JSON only, no additional text.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = response.data;
      const content = result.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);

      return {
        score: Number((parsed.score || 0).toFixed(1)),
        fluency: parsed.fluency || 'N/A',
        lexicalResource: parsed.lexicalResource || 'N/A',
        grammar: parsed.grammar || 'N/A',
        pronunciation: parsed.pronunciation || 'N/A',
        overallFeedback: parsed.overallFeedback || 'N/A',
      };

    } catch (error: any) {
      if (error.response?.data?.error) {
        const apiError = error.response.data.error;
        if (apiError.code === 'insufficient_quota') {
          console.error('❌ OpenAI API quota tugagan. Iltimos, API key ni tekshiring va billing ni to\'ldiring.');
        } else {
          console.error('❌ OpenAI API xatosi:', apiError.message || apiError);
        }
      } else {
        console.error('❌ Error scoring speaking with AI:', error.message || error);
      }
      return {
        score: 0,
        fluency: 'AI baholash xatosi. Iltimos, API key ni tekshiring.',
        lexicalResource: 'AI baholash xatosi. Iltimos, API key ni tekshiring.',
        grammar: 'AI baholash xatosi. Iltimos, API key ni tekshiring.',
        pronunciation: 'AI baholash xatosi. Iltimos, API key ni tekshiring.',
        overallFeedback: 'AI baholash xatosi. Iltimos, API key ni tekshiring.',
      };
    }
  }
}

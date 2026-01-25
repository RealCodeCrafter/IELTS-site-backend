import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { Exam, ExamContent, Question } from '../exams/exam.entity';
import { SpeechToTextService } from './speech-to-text.service';
import { OpenAIService } from './openai.service';

export interface QuestionResult {
  questionId: string;
  question: string;
  userAnswer: string;
  correctAnswer: string | string[];
  isCorrect: boolean;
  explanation?: string;
}

export interface DetailedResults {
  listening?: {
    score: number;
    correct: number;
    total: number;
    questions: QuestionResult[];
  };
  reading?: {
    score: number;
    correct: number;
    total: number;
    questions: QuestionResult[];
  };
  writing?: {
    score: number;
    task1?: {
      wordCount: number;
      targetWords: number;
      score: number;
      feedback: string;
    };
    task2?: {
      wordCount: number;
      targetWords: number;
      score: number;
      feedback: string;
    };
  };
  speaking?: {
    score: number;
    parts: Array<{
      partNumber: number;
      score: number;
      wordCount: number;
      feedback: string;
    }>;
  };
}

export interface ScoreResult {
  listening: number;
  reading: number;
  writing: number;
  speaking: number;
  overall: number;
  detailedResults?: DetailedResults;
}

@Injectable()
export class AiScoringService {
  constructor(
    @Inject(forwardRef(() => SpeechToTextService))
    private readonly speechToText: SpeechToTextService,
    @Inject(forwardRef(() => OpenAIService))
    private readonly openAI: OpenAIService,
  ) {}

  // Listening va Reading - savollarga asoslangan avtomatik baholash
  async score(exam: Exam, answers: Record<string, unknown>): Promise<ScoreResult> {
    const content = exam.content;
    let listening = 0;
    let reading = 0;
    let writing = 0;
    let speaking = 0;
    const detailedResults: DetailedResults = {};

    // Listening baholash
    if (content.listening) {
      const listeningResult = this.scoreListeningDetailed(content, answers);
      listening = listeningResult.score;
      detailedResults.listening = listeningResult;
    }

    // Reading baholash
    if (content.reading) {
      const readingResult = this.scoreReadingDetailed(content, answers);
      reading = readingResult.score;
      detailedResults.reading = readingResult;
    }

    // Writing baholash (AI orqali)
    if (content.writing) {
      const writingResult = await this.scoreWritingDetailed(content, answers);
      writing = writingResult.score;
      detailedResults.writing = writingResult;
    }

    // Speaking baholash
    if (content.speaking) {
      const speakingResult = await this.scoreSpeakingDetailed(content, answers);
      speaking = speakingResult.score;
      detailedResults.speaking = speakingResult;
    }

    const overall = Number(((listening + reading + writing + speaking) / 4).toFixed(1));
    return { listening, reading, writing, speaking, overall, detailedResults };
  }

  private scoreListening(content: ExamContent, answers: Record<string, unknown>): number {
    if (!content.listening) return 0;

    let correct = 0;
    let total = 0;

    content.listening.sections.forEach((section) => {
      section.questions.forEach((question) => {
        total++;
        const userAnswer = answers[`listening_${question.id}`];
        if (this.isAnswerCorrect(question, userAnswer)) {
          correct++;
        }
      });
    });

    if (total === 0) return 0;
    return this.calculateIELTSBand(correct, total, 40);
  }

  private scoreListeningDetailed(content: ExamContent, answers: Record<string, unknown>): { score: number; correct: number; total: number; questions: QuestionResult[] } {
    if (!content.listening) return { score: 0, correct: 0, total: 0, questions: [] };

    let correct = 0;
    let total = 0;
    const questions: QuestionResult[] = [];

    content.listening.sections.forEach((section) => {
      section.questions.forEach((question) => {
        total++;
        const userAnswer = answers[`listening_${question.id}`];
        const isCorrect = this.isAnswerCorrect(question, userAnswer);
        if (isCorrect) correct++;

        questions.push({
          questionId: question.id,
          question: question.question || '',
          userAnswer: userAnswer ? String(userAnswer) : '(javob berilmagan)',
          correctAnswer: question.correctAnswer || '',
          isCorrect,
          explanation: isCorrect 
            ? '✅ To\'g\'ri javob!' 
            : `❌ Noto'g'ri. To'g'ri javob: ${Array.isArray(question.correctAnswer) ? question.correctAnswer.join(' yoki ') : question.correctAnswer}`,
        });
      });
    });

    const score = total === 0 ? 0 : this.calculateIELTSBand(correct, total, 40);
    return { score, correct, total, questions };
  }

  private scoreReading(content: ExamContent, answers: Record<string, unknown>): number {
    if (!content.reading) return 0;

    let correct = 0;
    let total = 0;

    content.reading.passages.forEach((passage) => {
      passage.questions.forEach((question) => {
        total++;
        const userAnswer = answers[`reading_${question.id}`];
        if (this.isAnswerCorrect(question, userAnswer)) {
          correct++;
        }
      });
    });

    if (total === 0) return 0;
    return this.calculateIELTSBand(correct, total, 40);
  }

  private scoreReadingDetailed(content: ExamContent, answers: Record<string, unknown>): { score: number; correct: number; total: number; questions: QuestionResult[] } {
    if (!content.reading) return { score: 0, correct: 0, total: 0, questions: [] };

    let correct = 0;
    let total = 0;
    const questions: QuestionResult[] = [];

    content.reading.passages.forEach((passage) => {
      passage.questions.forEach((question) => {
        total++;
        const userAnswer = answers[`reading_${question.id}`];
        const isCorrect = this.isAnswerCorrect(question, userAnswer);
        if (isCorrect) correct++;

        questions.push({
          questionId: question.id,
          question: question.question || '',
          userAnswer: userAnswer ? String(userAnswer) : '(javob berilmagan)',
          correctAnswer: question.correctAnswer || '',
          isCorrect,
          explanation: isCorrect 
            ? '✅ To\'g\'ri javob!' 
            : `❌ Noto'g'ri. To'g'ri javob: ${Array.isArray(question.correctAnswer) ? question.correctAnswer.join(' yoki ') : question.correctAnswer}`,
        });
      });
    });

    const score = total === 0 ? 0 : this.calculateIELTSBand(correct, total, 40);
    return { score, correct, total, questions };
  }

  private async scoreWriting(content: ExamContent, answers: Record<string, unknown>): Promise<number> {
    if (!content.writing) return 0;

    const task1Answer = String(answers.writing_task1 || '').trim();
    const task2Answer = String(answers.writing_task2 || '').trim();

    if (!task1Answer && !task2Answer) return 0;

    // AI orqali to'liq baholash
    const task1 = content.writing.tasks?.find(t => t.taskNumber === 1 || t.type === 'task1');
    const task2 = content.writing.tasks?.find(t => t.taskNumber === 2 || t.type === 'task2');
    const task1Type = task1?.type === 'task1' ? 'General' : 'General';
    const task2Type = task2?.type === 'task2' ? 'Essay' : 'Essay';
    const aiResult = await this.openAI.scoreWriting(task1Answer, task2Answer, task1Type, task2Type);

    if (!task1Answer) return aiResult.task2Score;
    if (!task2Answer) return aiResult.task1Score;

    return aiResult.overallScore;
  }

  private async scoreWritingDetailed(content: ExamContent, answers: Record<string, unknown>): Promise<{ score: number; task1?: any; task2?: any }> {
    if (!content.writing) return { score: 0 };

    const task1Answer = String(answers.writing_task1 || '').trim();
    const task2Answer = String(answers.writing_task2 || '').trim();

    if (!task1Answer && !task2Answer) return { score: 0 };

    const task1Words = task1Answer.split(/\s+/).filter((w) => w.length > 0).length;
    const task2Words = task2Answer.split(/\s+/).filter((w) => w.length > 0).length;
    
    // AI orqali to'liq baholash
    const task1 = content.writing.tasks?.find(t => t.taskNumber === 1 || t.type === 'task1');
    const task2 = content.writing.tasks?.find(t => t.taskNumber === 2 || t.type === 'task2');
    const task1Type = task1?.type === 'task1' ? 'General' : 'General';
    const task2Type = task2?.type === 'task2' ? 'Essay' : 'Essay';
    const aiResult = await this.openAI.scoreWriting(task1Answer, task2Answer, task1Type, task2Type);

    const result: any = { score: 0 };

    if (task1Answer) {
      result.task1 = {
        wordCount: task1Words,
        targetWords: 150,
        score: aiResult.task1Score,
        feedback: aiResult.task1Feedback,
      };
    }

    if (task2Answer) {
      result.task2 = {
        wordCount: task2Words,
        targetWords: 250,
        score: aiResult.task2Score,
        feedback: aiResult.task2Feedback,
      };
    }

    result.score = aiResult.overallScore;

    return result;
  }

  private async scoreSpeaking(content: ExamContent, answers: Record<string, unknown>): Promise<number> {
    if (!content.speaking) return 0;

    let totalScore = 0;
    let partCount = 0;

    if (content.speaking.parts && Array.isArray(content.speaking.parts)) {
      for (const [index, part] of content.speaking.parts.entries()) {
        const partNumber = part.partNumber || (index + 1);
        const transcriptKey = `speaking_part${partNumber}`;
        const audioKey = `speaking_part${partNumber}_audio`;
        let transcript = String(answers[transcriptKey] || '').trim();
        const audio = answers[audioKey];
        
        // Agar transcript yozilmagan, lekin audio yozilgan bo'lsa, audio faylni matnga o'girish
        if (!transcript && audio) {
          transcript = await this.speechToText.transcribeAudio(String(audio), partNumber);
        }
        
        // Agar transcript mavjud bo'lsa (yozilgan yoki audio dan o'girilgan), AI orqali baholash
        if (transcript && transcript.length > 0 && !transcript.startsWith('[')) {
          const topic = part.topic || `Part ${partNumber} topic`;
          const aiResult = await this.openAI.scoreSpeaking(transcript, partNumber, topic);
          totalScore += aiResult.score;
          partCount++;
        }
      }
    }

    if (partCount === 0) return 0;
    return Number((totalScore / partCount).toFixed(1));
  }

  private async scoreSpeakingDetailed(content: ExamContent, answers: Record<string, unknown>): Promise<{ score: number; parts: Array<any> }> {
    if (!content.speaking) return { score: 0, parts: [] };

    const parts: Array<any> = [];
    let totalScore = 0;
    let partCount = 0;

    if (content.speaking.parts && Array.isArray(content.speaking.parts)) {
      for (const [index, part] of content.speaking.parts.entries()) {
        const partNumber = part.partNumber || (index + 1);
        const transcriptKey = `speaking_part${partNumber}`;
        const audioKey = `speaking_part${partNumber}_audio`;
        let transcript = String(answers[transcriptKey] || '').trim();
        const audio = answers[audioKey];
        
        // Agar transcript yozilmagan, lekin audio yozilgan bo'lsa, audio faylni matnga o'girish
        if (!transcript && audio) {
          // OpenAI Whisper API orqali audio faylni matnga o'girish
          transcript = await this.speechToText.transcribeAudio(String(audio), partNumber);
        }
        
        // Agar transcript mavjud bo'lsa (yozilgan yoki audio dan o'girilgan), AI orqali baholash
        if (transcript && transcript.length > 0 && !transcript.startsWith('[')) {
          const words = transcript.split(/\s+/).filter((w) => w.length > 0).length;
          
          // AI orqali to'liq baholash
          const topic = part.topic || `Part ${partNumber} topic`;
          const aiResult = await this.openAI.scoreSpeaking(transcript, partNumber, topic);
          
          totalScore += aiResult.score;
          partCount++;

          parts.push({
            partNumber,
            score: aiResult.score,
            wordCount: words,
            feedback: `Fluency: ${aiResult.fluency}\n\nLexical Resource: ${aiResult.lexicalResource}\n\nGrammar: ${aiResult.grammar}\n\nPronunciation: ${aiResult.pronunciation}\n\nOverall: ${aiResult.overallFeedback}`,
          });
        } 
        // Agar hech narsa yozilmagan bo'lsa
        else {
          parts.push({
            partNumber,
            score: 0,
            wordCount: 0,
            feedback: '❌ Hech narsa yozilmagan. Iltimos, ovoz yozing.',
          });
        }
      }
    }

    const score = partCount === 0 ? 0 : Number((totalScore / partCount).toFixed(1));
    return { score, parts };
  }

  private isAnswerCorrect(question: Question, userAnswer: unknown): boolean {
    if (userAnswer === undefined || userAnswer === null || userAnswer === '') return false;
    if (!question.correctAnswer) return false;

    const correct = question.correctAnswer;
    const user = String(userAnswer).trim().toLowerCase().replace(/\s+/g, ' ');

    if (Array.isArray(correct)) {
      return correct.some((ans) => {
        const correctAns = String(ans).trim().toLowerCase().replace(/\s+/g, ' ');
        return correctAns === user;
      });
    }

    const correctAns = String(correct).trim().toLowerCase().replace(/\s+/g, ' ');
    return correctAns === user;
  }

  private calculateIELTSBand(correct: number, total: number, maxQuestions: number): number {
    if (total === 0) return 0;
    if (correct === 0) return 0; // Agar hech narsa belgilanmagan bo'lsa, 0 ball
    
    // Foizga asoslangan baholash (to'g'ri javoblar foizi)
    const percentage = (correct / total) * 100;
    
    // IELTS band conversion table - foizga asoslangan
    // Listening va Reading uchun standart IELTS jadvali
    if (percentage >= 97.5) return 9.0;  // 39-40/40 = 97.5-100%
    if (percentage >= 92.5) return 8.5;  // 37-38/40 = 92.5-97.5%
    if (percentage >= 87.5) return 8.0;  // 35-36/40 = 87.5-92.5%
    if (percentage >= 82.5) return 7.5;  // 33-34/40 = 82.5-87.5%
    if (percentage >= 75.0) return 7.0;  // 30-32/40 = 75-82.5%
    if (percentage >= 67.5) return 6.5;  // 27-29/40 = 67.5-75%
    if (percentage >= 57.5) return 6.0;  // 23-26/40 = 57.5-67.5%
    if (percentage >= 47.5) return 5.5;  // 19-22/40 = 47.5-57.5%
    if (percentage >= 37.5) return 5.0;  // 15-18/40 = 37.5-47.5%
    if (percentage >= 32.5) return 4.5;  // 13-14/40 = 32.5-37.5%
    if (percentage >= 25.0) return 4.0;  // 10-12/40 = 25-32.5%
    if (percentage >= 17.5) return 3.5;  // 7-9/40 = 17.5-25%
    if (percentage >= 10.0) return 3.0;  // 4-6/40 = 10-17.5%
    if (percentage >= 5.0) return 2.5;   // 2-3/40 = 5-10%
    if (percentage >= 2.5) return 2.0;   // 1/40 = 2.5-5%
    return 0.0; // 0% = 0.0 (bo'sh javoblar)
  }

  private estimateWritingScore(text: string, targetWords: number): number {
    if (!text || text.trim().length === 0) return 0;

    const words = text.split(/\s+/).filter((w) => w.length > 0).length;
    
    // So'zlar soniga asoslangan baholash (0-4 ball)
    let lengthScore = 0;
    if (words >= targetWords * 0.9) {
      lengthScore = 4.0; // 90%+ so'zlar
    } else if (words >= targetWords * 0.75) {
      lengthScore = 3.5; // 75-90%
    } else if (words >= targetWords * 0.6) {
      lengthScore = 3.0; // 60-75%
    } else if (words >= targetWords * 0.5) {
      lengthScore = 2.5; // 50-60%
    } else if (words >= targetWords * 0.4) {
      lengthScore = 2.0; // 40-50%
    } else if (words >= targetWords * 0.25) {
      lengthScore = 1.5; // 25-40%
    } else if (words > 0) {
      lengthScore = 1.0; // 0-25%
    }

    // Struktura (jumlalar, paragraflar) - 0-2 ball
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 10);
    const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
    let structureScore = 0;
    if (sentences.length >= 5 && paragraphs.length >= 2) {
      structureScore = 2.0;
    } else if (sentences.length >= 3) {
      structureScore = 1.5;
    } else if (sentences.length >= 1) {
      structureScore = 1.0;
    }

    // Lug'at boyligi - 0-2 ball
    const vocabularyScore = this.estimateVocabulary(text);

    // Grammatika - 0-1 ball (oddiy tekshirish)
    const grammarScore = this.estimateGrammar(text);

    // Jami: (lengthScore * 2 + structureScore + vocabularyScore + grammarScore) / 5 * 9
    // Length eng muhim (40%), qolganlari 20% har biri
    const total = (lengthScore * 0.4 + structureScore * 0.2 + vocabularyScore * 0.2 + grammarScore * 0.2) * 2.25;
    return Number(Math.min(Math.max(total, 0), 9).toFixed(1)); // 0-9 oralig'ida
  }

  private estimateSpeakingScore(text: string): number {
    if (!text || text.trim().length === 0) return 0;

    const words = text.split(/\s+/).filter((w) => w.length > 0).length;
    
    // Fluency (so'zlar soni) - 0-2.5 ball
    let fluencyScore = 0;
    if (words >= 150) {
      fluencyScore = 2.5; // Juda yaxshi
    } else if (words >= 100) {
      fluencyScore = 2.0; // Yaxshi
    } else if (words >= 70) {
      fluencyScore = 1.5; // O'rtacha
    } else if (words >= 40) {
      fluencyScore = 1.0; // Past
    } else if (words > 0) {
      fluencyScore = 0.5; // Juda past
    }

    // Lug'at boyligi - 0-2 ball
    const vocabularyScore = this.estimateVocabulary(text);

    // Grammatika - 0-2 ball
    const grammarScore = this.estimateGrammar(text);

    // Pronunciation - audio bo'lmasa, default 1.5 ball
    const pronunciationScore = 1.5;

    // Jami: (fluencyScore * 0.3 + vocabularyScore * 0.25 + grammarScore * 0.25 + pronunciationScore * 0.2) * 2.25
    const total = (fluencyScore * 0.3 + vocabularyScore * 0.25 + grammarScore * 0.25 + pronunciationScore * 0.2) * 2.25;
    return Number(Math.min(Math.max(total, 0), 9).toFixed(1)); // 0-9 oralig'ida
  }

  private estimateVocabulary(text: string): number {
    if (!text || text.trim().length === 0) return 0;

    const commonWords = ['the', 'is', 'are', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'a', 'an', 'this', 'that', 'it', 'he', 'she', 'we', 'they', 'you', 'i', 'am', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'can', 'could', 'should', 'may', 'might', 'must'];
    const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
    const uniqueWords = new Set(words);
    const totalWords = words.length;
    
    // Oddiy so'zlarni filtrlash
    const advancedWords = Array.from(uniqueWords).filter((w) => {
      const cleanWord = w.replace(/[.,!?;:()\[\]{}'"]/g, '');
      return !commonWords.includes(cleanWord) && cleanWord.length > 3;
    });
    
    // Lug'at boyligi: noyob so'zlar foizi va uzun so'zlar
    const uniqueRatio = uniqueWords.size / Math.max(totalWords, 1);
    const longWords = advancedWords.filter((w) => w.length > 6).length;
    
    // 0-2 ball
    let score = 0;
    if (uniqueRatio >= 0.6 && longWords >= 5) {
      score = 2.0; // Juda yaxshi lug'at
    } else if (uniqueRatio >= 0.5 && longWords >= 3) {
      score = 1.5; // Yaxshi lug'at
    } else if (uniqueRatio >= 0.4 && advancedWords.length >= 5) {
      score = 1.0; // O'rtacha lug'at
    } else if (uniqueRatio >= 0.3 || advancedWords.length >= 3) {
      score = 0.5; // Past lug'at
    }
    
    return Math.min(score, 2);
  }

  private estimateGrammar(text: string): number {
    if (!text || text.trim().length === 0) return 0;

    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 5);
    if (sentences.length === 0) return 0.5;

    // Jumlalar soni va uzunligi
    const avgSentenceLength = sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / sentences.length;
    
    // 0-2 ball
    let score = 0;
    if (sentences.length >= 5 && avgSentenceLength >= 10) {
      score = 2.0; // Juda yaxshi grammatika
    } else if (sentences.length >= 3 && avgSentenceLength >= 8) {
      score = 1.5; // Yaxshi grammatika
    } else if (sentences.length >= 2 && avgSentenceLength >= 6) {
      score = 1.0; // O'rtacha grammatika
    } else if (sentences.length >= 1) {
      score = 0.5; // Past grammatika
    }
    
    return Math.min(score, 2);
  }

  private getWritingFeedback(wordCount: number, targetWords: number, score: number): string {
    const percentage = (wordCount / targetWords) * 100;
    let feedback = '';

    if (wordCount === 0) {
      feedback = '❌ Javob yozilmagan.';
    } else if (percentage < 50) {
      feedback = `⚠️ So'zlar soni yetarli emas (${wordCount}/${targetWords}). Ko'proq yozing.`;
    } else if (percentage < 75) {
      feedback = `⚠️ So'zlar soni biroz kam (${wordCount}/${targetWords}). Yana bir nechta gap qo'shing.`;
    } else if (percentage >= 90) {
      feedback = `✅ So'zlar soni yaxshi (${wordCount}/${targetWords}).`;
    } else {
      feedback = `✅ So'zlar soni yetarli (${wordCount}/${targetWords}).`;
    }

    if (score >= 7.0) {
      feedback += ' Yaxshi struktura va lug\'at.';
    } else if (score >= 5.0) {
      feedback += ' O\'rtacha daraja. Ko\'proq murakkab jumlalar va lug\'at ishlatishga harakat qiling.';
    } else {
      feedback += ' Grammatika va lug\'atni yaxshilash kerak.';
    }

    return feedback;
  }

  private getSpeakingFeedback(wordCount: number, score: number): string {
    let feedback = '';

    if (wordCount === 0) {
      feedback = '❌ Transcript yozilmagan.';
    } else if (wordCount < 40) {
      feedback = `⚠️ Juda qisqa javob (${wordCount} so'z). Ko'proq gapiring.`;
    } else if (wordCount < 70) {
      feedback = `⚠️ Javob biroz qisqa (${wordCount} so'z). Batafsilroq javob bering.`;
    } else if (wordCount >= 100) {
      feedback = `✅ Yaxshi uzunlik (${wordCount} so'z).`;
    } else {
      feedback = `✅ Yetarli uzunlik (${wordCount} so'z).`;
    }

    if (score >= 7.0) {
      feedback += ' Yaxshi lug\'at va grammatika.';
    } else if (score >= 5.0) {
      feedback += ' O\'rtacha daraja. Ko\'proq murakkab jumlalar ishlatishga harakat qiling.';
    } else {
      feedback += ' Lug\'at va grammatikani yaxshilash kerak.';
    }

    return feedback;
  }

  /**
   * Audio fayl hajmini olish
   */
  private getAudioSize(base64Audio: string): number {
    try {
      let base64Data = base64Audio;
      if (base64Audio.includes(',')) {
        base64Data = base64Audio.split(',')[1];
      }
      if (!base64Data) return 0;
      const audioBuffer = Buffer.from(base64Data, 'base64');
      return audioBuffer.length;
    } catch {
      return 0;
    }
  }

  /**
   * Audio fayl davomiyligini taxminiy hisoblash (hajmga asoslangan)
   */
  private estimateAudioDurationFromSize(audioSize: number): number {
    // Taxminiy: 1KB = 0.1 sekund (webm format uchun)
    return Math.round((audioSize / 1024) * 0.1);
  }
}

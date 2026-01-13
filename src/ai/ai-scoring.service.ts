import { Injectable } from '@nestjs/common';
import { Exam, ExamContent, Question } from '../exams/exam.entity';

interface ScoreResult {
  listening: number;
  reading: number;
  writing: number;
  speaking: number;
  overall: number;
}

@Injectable()
export class AiScoringService {
  // Listening va Reading - savollarga asoslangan avtomatik baholash
  async score(exam: Exam, answers: Record<string, unknown>): Promise<ScoreResult> {
    const content = exam.content;
    let listening = 0;
    let reading = 0;
    let writing = 0;
    let speaking = 0;

    // Listening baholash
    if (content.listening) {
      listening = this.scoreListening(content, answers);
    }

    // Reading baholash
    if (content.reading) {
      reading = this.scoreReading(content, answers);
    }

    // Writing baholash (AI/heuristic)
    if (content.writing) {
      writing = this.scoreWriting(content, answers);
    }

    // Speaking baholash (AI/heuristic)
    if (content.speaking) {
      speaking = this.scoreSpeaking(content, answers);
    }

    const overall = Number(((listening + reading + writing + speaking) / 4).toFixed(1));
    return { listening, reading, writing, speaking, overall };
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
    // IELTS Listening: 40 questions, 9.0 = 39-40, 8.5 = 37-38, etc.
    return this.calculateIELTSBand(correct, total, 40);
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
    // IELTS Reading: 40 questions
    return this.calculateIELTSBand(correct, total, 40);
  }

  private scoreWriting(content: ExamContent, answers: Record<string, unknown>): number {
    if (!content.writing) return 0;

    const task1Answer = String(answers.writing_task1 || '');
    const task2Answer = String(answers.writing_task2 || '');

    // Heuristic scoring based on length, structure, keywords
    const task1Score = this.estimateWritingScore(task1Answer, 150);
    const task2Score = this.estimateWritingScore(task2Answer, 250);

    return Number(((task1Score + task2Score * 2) / 3).toFixed(1)); // Task 2 is worth more
  }

  private scoreSpeaking(content: ExamContent, answers: Record<string, unknown>): number {
    if (!content.speaking) return 0;

    const speakingAnswer = String(answers.speaking || '');
    return this.estimateSpeakingScore(speakingAnswer);
  }

  private isAnswerCorrect(question: Question, userAnswer: unknown): boolean {
    if (userAnswer === undefined || userAnswer === null) return false;

    const correct = question.correctAnswer;
    const user = String(userAnswer).trim().toLowerCase();

    if (Array.isArray(correct)) {
      return correct.some((ans) => String(ans).trim().toLowerCase() === user);
    }

    return String(correct).trim().toLowerCase() === user;
  }

  private calculateIELTSBand(correct: number, total: number, maxQuestions: number): number {
    // IELTS band score conversion
    const percentage = (correct / total) * (maxQuestions / total);
    const rawScore = Math.round((correct / total) * maxQuestions);

    // IELTS band conversion table (approximate)
    if (rawScore >= 39) return 9.0;
    if (rawScore >= 37) return 8.5;
    if (rawScore >= 35) return 8.0;
    if (rawScore >= 33) return 7.5;
    if (rawScore >= 30) return 7.0;
    if (rawScore >= 27) return 6.5;
    if (rawScore >= 23) return 6.0;
    if (rawScore >= 19) return 5.5;
    if (rawScore >= 15) return 5.0;
    if (rawScore >= 13) return 4.5;
    if (rawScore >= 10) return 4.0;
    return 3.5;
  }

  private estimateWritingScore(text: string, targetWords: number): number {
    const words = text.split(/\s+/).filter((w) => w.length > 0).length;
    const lengthScore = Math.min((words / targetWords) * 2, 2); // Max 2 points for length
    const structureScore = text.includes('.') && text.length > 50 ? 2 : 1;
    const vocabularyScore = this.estimateVocabulary(text);
    const grammarScore = this.estimateGrammar(text);

    const total = (lengthScore + structureScore + vocabularyScore + grammarScore) / 4;
    return Number((total * 4.5).toFixed(1)); // Scale to 0-9
  }

  private estimateSpeakingScore(text: string): number {
    const words = text.split(/\s+/).filter((w) => w.length > 0).length;
    const fluencyScore = words > 100 ? 2 : words > 50 ? 1.5 : 1;
    const vocabularyScore = this.estimateVocabulary(text);
    const grammarScore = this.estimateGrammar(text);
    const pronunciationScore = 1.5; // Default, would need audio analysis

    const total = (fluencyScore + vocabularyScore + grammarScore + pronunciationScore) / 4;
    return Number((total * 4.5).toFixed(1));
  }

  private estimateVocabulary(text: string): number {
    const commonWords = ['the', 'is', 'are', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with'];
    const words = text.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const advancedWords = Array.from(uniqueWords).filter((w) => !commonWords.includes(w) && w.length > 4);
    return Math.min(advancedWords.length / 10, 2);
  }

  private estimateGrammar(text: string): number {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    if (sentences.length === 0) return 0.5;
    return Math.min(sentences.length / 5, 2);
  }
}

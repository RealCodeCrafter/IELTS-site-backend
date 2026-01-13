import { DataSource } from 'typeorm';
import { Exam } from '../exams/exam.entity';

export async function seedExams(dataSource: DataSource) {
  const examRepo = dataSource.getRepository(Exam);

  const exams = [
    {
      title: 'IELTS Academic - Full Test 1',
      type: 'full' as const,
      content: {
        description: 'To\'liq IELTS Academic imtihoni - barcha 4 bo\'lim',
        duration: 180,
        listening: {
          sections: [
            {
              sectionNumber: 1,
              audioUrl: '/audio/listening-1.mp3',
              questions: [
                {
                  id: 'l1_q1',
                  type: 'multiple-choice',
                  question: 'What is the main topic of the conversation?',
                  options: ['A) Travel plans', 'B) Job interview', 'C) University course', 'D) Restaurant booking'],
                  correctAnswer: 'A',
                  points: 1,
                },
                {
                  id: 'l1_q2',
                  type: 'fill-blank',
                  question: 'The flight departs at _____',
                  correctAnswer: '14:30',
                  points: 1,
                },
              ],
            },
          ],
          totalQuestions: 40,
        },
        reading: {
          passages: [
            {
              passageNumber: 1,
              title: 'The History of Coffee',
              content: 'Coffee is one of the most popular beverages in the world...',
              questions: [
                {
                  id: 'r1_q1',
                  type: 'multiple-choice',
                  question: 'Where did coffee originate?',
                  options: ['A) Brazil', 'B) Ethiopia', 'C) Colombia', 'D) Vietnam'],
                  correctAnswer: 'B',
                  points: 1,
                },
              ],
            },
          ],
          totalQuestions: 40,
        },
        writing: {
          tasks: [
            {
              taskNumber: 1,
              type: 'task1',
              title: 'Task 1: Graph Description',
              description: 'The graph below shows the percentage of households with internet access in different countries. Summarize the information by selecting and reporting the main features.',
              wordCount: 150,
            },
            {
              taskNumber: 2,
              type: 'task2',
              title: 'Task 2: Essay',
              description: 'Some people think that technology has made our lives more complicated. Others believe it has made life easier. Discuss both views and give your opinion.',
              wordCount: 250,
            },
          ],
        },
        speaking: {
          parts: [
            {
              partNumber: 1,
              title: 'Introduction and Interview',
              description: 'Answer questions about yourself',
              questions: ['What is your name?', 'Where are you from?', 'Do you work or study?'],
            },
            {
              partNumber: 2,
              title: 'Long Turn',
              description: 'Speak about a topic for 2 minutes',
              topic: 'Describe a place you would like to visit',
              timeLimit: 2,
            },
            {
              partNumber: 3,
              title: 'Discussion',
              description: 'Discuss the topic in more detail',
              questions: ['Why do people like to travel?', 'What are the benefits of tourism?'],
            },
          ],
        },
      },
    },
  ];

  let created = 0;
  for (const examData of exams) {
    const exists = await examRepo.findOne({ where: { title: examData.title } });
    if (!exists) {
      await examRepo.save(examRepo.create(examData));
      created++;
      console.log(`✅ Imtihon yaratildi: ${examData.title}`);
    }
  }

  if (created > 0) {
    console.log(`✅ Jami ${created} ta imtihon yaratildi`);
  } else {
    console.log('ℹ️  Barcha imtihonlar allaqachon mavjud');
  }
}

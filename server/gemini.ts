import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];


const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", safetySettings });

export interface ExplanationRequest {
  topic: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  context?: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface QuizResponse {
  questions: QuizQuestion[];
}

export interface FlashcardResponse {
  cards: Array<{
    front: string;
    back: string;
  }>;
}

export async function generateExplanation(request: ExplanationRequest): Promise<string> {
  let prompt = "";
  
  switch (request.difficulty) {
    case "beginner":
      prompt = `Explain "${request.topic}" like I'm 10 years old. Use simple words, analogies, and make it fun and easy to understand. Include examples that a child would relate to.`;
      break;
    case "intermediate":
      prompt = `Provide a quick revision summary of "${request.topic}". Focus on key points, important concepts, and essential information. Make it concise but comprehensive for someone who needs a refresher.`;
      break;
    case "advanced":
      prompt = `Provide a college-level, in-depth explanation of "${request.topic}". Include technical details, theoretical foundations, practical applications, and advanced concepts. Assume the reader has some background knowledge.`;
      break;
  }

  if (request.context) {
    prompt += ` Context: ${request.context}`;
  }

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    return response.text();
  } catch (error) {
    console.error("Error generating explanation:", error);
    throw new Error("Failed to generate explanation");
  }
}

export async function generateQuiz(topic: string, questionCount: number = 5): Promise<QuizResponse> {
  const prompt = `Create ${questionCount} multiple-choice questions about "${topic}".
  
  Respond with JSON in this exact format:
  {
    "questions": [
      {
        "question": "Question text here",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correctAnswer": 0,
        "explanation": "Why this answer is correct"
      }
    ]
  }
  
  Make sure:
  - Questions are educational and test understanding
  - Each question has exactly 4 options
  - correctAnswer is the index (0-3) of the correct option
  - Include clear explanations for each answer`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const rawJson = response.text();
    if (rawJson) {
      const data: QuizResponse = JSON.parse(rawJson);
      return data;
    } else {
      throw new Error("Empty response from model");
    }
  } catch (error) {
    console.error("Error generating quiz:", error);
    throw new Error("Failed to generate quiz");
  }
}

export async function generateFlashcards(topic: string, cardCount: number = 10): Promise<FlashcardResponse> {
  const prompt = `Create ${cardCount} flashcards about "${topic}".
  
  Respond with JSON in this exact format:
  {
    "cards": [
      {
        "front": "Question or term",
        "back": "Answer or definition"
      }
    ]
  }
  
  Make the flashcards educational and focused on key concepts, terms, and facts about the topic.`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const rawJson = response.text();
    if (rawJson) {
      const data: FlashcardResponse = JSON.parse(rawJson);
      return data;
    } else {
      throw new Error("Empty response from model");
    }
  } catch (error) {
    console.error("Error generating flashcards:", error);
    throw new Error("Failed to generate flashcards");
  }
}

export async function analyzeQuizPerformance(
  questions: QuizQuestion[],
  userAnswers: number[],
  topic: string
): Promise<string> {
  const correctAnswers = questions.map((q, index) => ({
    question: q.question,
    correct: q.correctAnswer,
    user: userAnswers[index],
    isCorrect: q.correctAnswer === userAnswers[index]
  }));

  const score = correctAnswers.filter(a => a.isCorrect).length;
  const incorrectQuestions = correctAnswers.filter(a => !a.isCorrect);

  const prompt = `Analyze this quiz performance for the topic "${topic}":
  
  Score: ${score}/${questions.length}
  
  Incorrect answers:
  ${incorrectQuestions.map(q => `- ${q.question} (chose option ${q.user}, correct was ${q.correct})`).join('\n')}
  
  Provide:
  1. Areas that need improvement
  2. Specific concepts to review
  3. Recommended next steps for learning
  4. Encouragement and positive feedback
  
  Keep it constructive and helpful.`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    return response.text();
  } catch (error) {
    console.error("Error analyzing quiz performance:", error);
    throw new Error("Failed to analyze quiz performance");
  }
}

export async function generateInterviewQuestions(
  role: string,
  level: string = "intermediate"
): Promise<{ questions: string[]; tips: string }> {
  const prompt = `Generate 5 interview questions for a ${level} level ${role} position.
  
  Respond with JSON in this exact format:
  {
    "questions": ["Question 1", "Question 2", etc.],
    "tips": "General tips for answering these types of questions"
  }
  
  Include a mix of technical and behavioral questions appropriate for the role and level.`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const rawJson = response.text();
    if (rawJson) {
      return JSON.parse(rawJson);
    } else {
      throw new Error("Empty response from model");
    }
  } catch (error) {
    console.error("Error generating interview questions:", error);
    throw new Error("Failed to generate interview questions");
  }
}

export async function generateChatResponse(
  topicTitle: string,
  topicContent: string,
  history: { role: string; parts: { text: string }[] }[],
  question: string
): Promise<string> {
  const systemPrompt = `You are "Chaitanya AI", a friendly and encouraging learning assistant. Your ONLY purpose is to discuss the topic of "${topicTitle}".

Strict rules:
- NEVER answer questions or discuss topics unrelated to "${topicTitle}".
- If asked about anything else, politely decline and steer the conversation back to "${topicTitle}". For example: "That's an interesting question, but my focus is to help you master ${topicTitle}. Shall we get back to it?"
- Keep your answers concise and easy to understand.
- Use the provided context to answer questions accurately.

Here is the context for "${topicTitle}":
---
${topicContent}
---
`;

  try {
    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: `Great! I'm ready to help you learn about ${topicTitle}. Ask me anything!` }] },
        ...history,
      ],
      generationConfig: {
        maxOutputTokens: 1000,
      },
    });

    const result = await chat.sendMessage(question);
    const response = result.response;
    return response.text();
  } catch (error) {
    console.error("Error generating chat response:", error);
    throw new Error("Failed to generate chat response");
  }
}

// This is a mock function. In a real application, you would use the YouTube Data API.
export async function searchYoutubeVideos(query: string) {
  console.log(`Searching YouTube for: ${query}`);
  // Mock data representing a YouTube API response
  return [
    {
      id: 'jfKfPfyJRdk',
      title: `Learn ${query} in 100 Seconds`,
      thumbnail: `https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg`,
      channel: 'Fireship',
      duration: '2:22',
    },
    {
      id: 'DHvZLI7Db8E',
      title: `What is ${query}?`,
      thumbnail: `https://i.ytimg.com/vi/DHvZLI7Db8E/hqdefault.jpg`,
      channel: 'IBM Technology',
      duration: '7:44',
    },
    {
      id: 's_LpPU_pQjY',
      title: `${query} for Beginners`,
      thumbnail: `https://i.ytimg.com/vi/s_LpPU_pQjY/hqdefault.jpg`,
      channel: 'freeCodeCamp.org',
      duration: '1:53:23',
    },
     {
      id: 'y-de0y2NpLo',
      title: `Introduction to ${query}`,
      thumbnail: `https://i.ytimg.com/vi/y-de0y2NpLo/hqdefault.jpg`,
      channel: 'Simplilearn',
      duration: '10:05',
    },
  ];
}

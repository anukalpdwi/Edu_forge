import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from "@google/generative-ai";
import OpenAI from "openai";

// --- Google Gemini Setup ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const flashModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest", safetySettings });
const proModel = genAI.getGenerativeModel({ model: "gemini-pro", safetySettings });


// --- OpenAI Setup ---
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


// --- Interfaces ---
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
  cards: Array<{ front: string; back: string; }>;
}


// --- Gemini Powered Functions ---

export async function generateExplanation(request: ExplanationRequest): Promise<string> {
  let prompt = "";
  switch (request.difficulty) {
    case "beginner": prompt = `Explain "${request.topic}" like I'm 10 years old. Use simple words, analogies, and make it fun and easy to understand. Include examples that a child would relate to.`; break;
    case "intermediate": prompt = `Provide a quick revision summary of "${request.topic}". Focus on key points, important concepts, and essential information. Make it concise but comprehensive for someone who needs a refresher.`; break;
    case "advanced": prompt = `Provide a college-level, in-depth explanation of "${request.topic}". Include technical details, theoretical foundations, practical applications, and advanced concepts. Assume the reader has some background knowledge.`; break;
  }
  if (request.context) prompt += ` Context: ${request.context}`;
  
  try {
    const result = await flashModel.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Error generating explanation:", error);
    throw new Error("Failed to generate explanation");
  }
}

export async function generateQuiz(topic: string, questionCount: number = 5): Promise<QuizResponse> {
    const prompt = `Create ${questionCount} multiple-choice questions about "${topic}". Respond with valid JSON in this exact format: {"questions": [{"question": "...", "options": ["A", "B", "C", "D"], "correctAnswer": 0, "explanation": "..."}]}`;
    try {
        const result = await proModel.generateContent(prompt);
        const text = result.response.text().replace(/```json/g, "").replace(/```/g, "");
        return JSON.parse(text);
    } catch (error) {
        console.error("Error generating quiz:", error);
        throw new Error("Failed to generate quiz");
    }
}

export async function generateFlashcards(topic: string, cardCount: number = 10): Promise<FlashcardResponse> {
    const prompt = `Create ${cardCount} flashcards about "${topic}". Respond with valid JSON in this exact format: {"cards": [{"front": "...", "back": "..."}]}`;
    try {
        const result = await proModel.generateContent(prompt);
        const text = result.response.text().replace(/```json/g, "").replace(/```/g, "");
        return JSON.parse(text);
    } catch (error) {
        console.error("Error generating flashcards:", error);
        throw new Error("Failed to generate flashcards");
    }
}

export async function generateInterviewQuestions(role: string, level: string = "intermediate"): Promise<{ questions: string[]; tips: string }> {
    const prompt = `Generate 5 interview questions for a ${level} level ${role} position. Respond with valid JSON in this exact format: {"questions": ["...", "..."], "tips": "..."}`;
    try {
        const result = await proModel.generateContent(prompt);
        const text = result.response.text().replace(/```json/g, "").replace(/```/g, "");
        return JSON.parse(text);
    } catch (error) {
        console.error("Error generating interview questions:", error);
        throw new Error("Failed to generate interview questions");
    }
}


// --- OpenAI Powered Chatbot ---

export async function generateChatResponse(topicTitle: string, topicContent: string, history: OpenAI.Chat.Completions.ChatCompletionMessageParam[], question: string): Promise<string> {
  const systemPrompt = `You are "Chaitanya AI", a friendly and encouraging learning assistant. Your ONLY purpose is to discuss the topic of "${topicTitle}". Strict rules: - NEVER answer questions or discuss topics unrelated to "${topicTitle}". - If asked about anything else, politely decline and steer the conversation back to "${topicTitle}". For example: "That's an interesting question, but my focus is to help you master ${topicTitle}. Shall we get back to it?" - Keep your answers concise and easy to understand. - Use the provided context to answer questions accurately. Here is the context for "${topicTitle}": --- ${topicContent} ---`;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: question }
  ];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      temperature: 0.7,
      max_tokens: 500,
    });
    return response.choices[0].message.content || "I'm not sure how to respond to that. Can you ask another way?";
  } catch (error) {
    console.error("Error generating chat response from OpenAI:", error);
    throw new Error("Failed to generate chat response");
  }
}


// --- Mock YouTube Search ---
export async function searchYoutubeVideos(query: string) {
  return [
    { id: 'jfKfPfyJRdk', title: `Learn ${query} in 100 Seconds`, thumbnail: `https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg`, channel: 'Fireship', duration: '2:22' },
    { id: 'DHvZLI7Db8E', title: `What is ${query}?`, thumbnail: `https://i.ytimg.com/vi/DHvZLI7Db8E/hqdefault.jpg`, channel: 'IBM Technology', duration: '7:44' },
    { id: 's_LpPU_pQjY', title: `${query} for Beginners`, thumbnail: `https://i.ytimg.com/vi/s_LpPU_pQjY/hqdefault.jpg`, channel: 'freeCodeCamp.org', duration: '1:53:23' },
    { id: 'y-de0y2NpLo', title: `Introduction to ${query}`, thumbnail: `https://i.ytimg.com/vi/y-de0y2NpLo/hqdefault.jpg`, channel: 'Simplilearn', duration: '10:05' },
  ];
}
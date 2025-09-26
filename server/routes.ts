import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import multer from "multer";
import { storage } from "./storage";
import { setupGoogleAuth, isAuthenticated } from "./googleAuth";
import {
  generateExplanation,
  generateQuiz,
  generateFlashcards,
  generateChatResponse,
  searchYoutubeVideos,
  generateInterviewQuestions,
  type ExplanationRequest,
} from "./gemini";
import {
  insertTopicSchema,
  insertQuizSchema,
  insertPostSchema,
  insertStudyGroupSchema,
} from "@shared/schema";

// Helper to get user ID consistently
const getUserId = (req: Request): string => {
    const user = req.user as any;
    if (!user) throw new Error("User not authenticated");
    return user.id || user.claims?.sub;
};


// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Google Auth middleware
  setupGoogleAuth(app);

  // Auth routes
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    res.json(req.user);
  });

  // Topic routes
  app.post("/api/topics", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const topicData = insertTopicSchema.parse({ ...req.body, userId });
      const topic = await storage.createTopic(topicData);
      await storage.createLearningSession({
        userId,
        topicId: topic.id,
        activityType: "study",
        xpGained: 10,
      });
      await storage.updateUserXP(userId, 10);
      await storage.updateUserStreak(userId);
      res.json(topic);
    } catch (error) {
      console.error("Error creating topic:", error);
      res.status(500).json({ message: "Failed to create topic" });
    }
  });

  app.get("/api/topics", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const topics = await storage.getUserTopics(userId);
      res.json(topics);
    } catch (error) {
      console.error("Error fetching topics:", error);
      res.status(500).json({ message: "Failed to fetch topics" });
    }
  });

  app.get("/api/topics/:id", isAuthenticated, async (req, res) => {
    try {
      const topic = await storage.getTopic(req.params.id);
      if (!topic) {
        return res.status(404).json({ message: "Topic not found" });
      }
      res.json(topic);
    } catch (error) {
      console.error("Error fetching topic:", error);
      res.status(500).json({ message: "Failed to fetch topic" });
    }
  });

  app.get("/api/topics/:topicId/flashcards", isAuthenticated, async (req, res) => {
    try {
      const flashcards = await storage.getTopicFlashcards(req.params.topicId);
      res.json(flashcards);
    } catch (error) {
      console.error("Error fetching flashcards:", error);
      res.status(500).json({ message: "Failed to fetch flashcards" });
    }
  });

  app.patch("/api/topics/:id/progress", isAuthenticated, async (req, res) => {
    try {
      const { progress } = req.body;
      if (typeof progress !== "number" || progress < 0 || progress > 100) {
        return res.status(400).json({ message: "Invalid progress value" });
      }
      await storage.updateTopicProgress(req.params.id, progress);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating progress:", error);
      res.status(500).json({ message: "Failed to update progress" });
    }
  });

  // AI content generation routes
  app.post("/api/ai/explain", isAuthenticated, async (req, res) => {
    try {
      const { topic, difficulty, context } = req.body;
      
      if (!topic || !difficulty) {
        return res.status(400).json({ message: "Topic and difficulty are required" });
      }

      const request: ExplanationRequest = { topic, difficulty, context };
      const explanation = await generateExplanation(request);
      
      res.json({ explanation });
    } catch (error) {
      console.error("Error generating explanation:", error);
      res.status(500).json({ message: "Failed to generate explanation" });
    }
  });

  app.post("/api/ai/chat", isAuthenticated, async (req, res) => {
    try {
      const { topicTitle, topicContent, history, question } = req.body;
      if (!topicTitle || !topicContent || !question) {
        return res.status(400).json({ message: "Topic context and question are required" });
      }
      const answer = await generateChatResponse(topicTitle, topicContent, history || [], question);
      res.json({ answer });
    } catch (error) {
       console.error("Error in chat:", error);
       res.status(500).json({ message: "Failed to get chat response" });
    }
  });

  app.post("/api/ai/quiz", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { topic, questionCount = 5, topicId } = req.body;
      
      if (!topic) {
        return res.status(400).json({ message: "Topic is required" });
      }

      const quizData = await generateQuiz(topic, questionCount);
      
      const quiz = await storage.createQuiz({
        topicId: topicId,
        userId,
        title: `${topic} Quiz`,
        questions: quizData.questions,
      });
      
      res.json({ quiz, questions: quizData.questions });
    } catch (error) {
      console.error("Error generating quiz:", error);
      res.status(500).json({ message: "Failed to generate quiz" });
    }
  });

  app.post("/api/ai/flashcards", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { topic, topicId, cardCount = 10 } = req.body;
      
      if (!topic || !topicId) {
        return res.status(400).json({ message: "Topic and topicId are required" });
      }
  
      const flashcardsData = await generateFlashcards(topic, cardCount);
      
      const savedCards = [];
      for (const card of flashcardsData.cards) {
        const savedCard = await storage.createFlashcard({
          topicId: topicId,
          userId,
          front: card.front,
          back: card.back,
        });
        savedCards.push(savedCard);
      }
      
      res.json({ flashcards: savedCards });
    } catch (error) {
      console.error("Error generating flashcards:", error);
      res.status(500).json({ message: "Failed to generate flashcards" });
    }
  });

  app.post("/api/ai/interview", isAuthenticated, async (req, res) => {
    try {
      const { role, level = "intermediate" } = req.body;
      
      if (!role) {
        return res.status(400).json({ message: "Role is required" });
      }

      const interviewData = await generateInterviewQuestions(role, level);
      res.json(interviewData);
    } catch (error) {
      console.error("Error generating interview questions:", error);
      res.status(500).json({ message: "Failed to generate interview questions" });
    }
  });

  // Quiz attempt routes
  app.post("/api/quizzes/:id/attempt", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { answers } = req.body;
      
      const quiz = await storage.getTopic(req.params.id);
      if (!quiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }

      const score = Array.isArray(answers) ? Math.floor(Math.random() * answers.length) + 1 : 1;
      const totalQuestions = Array.isArray(answers) ? answers.length : 5;
      
      const attempt = await storage.submitQuizAttempt({
        quizId: req.params.id,
        userId,
        score,
        totalQuestions,
        answers,
      });
      
      const xpGained = Math.floor((score / totalQuestions) * 50);
      await storage.updateUserXP(userId, xpGained);
      
      await storage.createLearningSession({
        userId,
        activityType: "quiz",
        xpGained,
      });
      
      res.json({ attempt, xpGained });
    } catch (error) {
      console.error("Error submitting quiz attempt:", error);
      res.status(500).json({ message: "Failed to submit quiz attempt" });
    }
  });

  // Social feed routes
  app.get("/api/feed", isAuthenticated, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const posts = await storage.getFeedPosts(limit);
      res.json(posts);
    } catch (error) {
      console.error("Error fetching feed:", error);
      res.status(500).json({ message: "Failed to fetch feed" });
    }
  });

  app.post("/api/posts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const postData = insertPostSchema.parse({ ...req.body, userId });
      
      const post = await storage.createPost(postData);
      res.json(post);
    } catch (error) {
      console.error("Error creating post:", error);
      res.status(500).json({ message: "Failed to create post" });
    }
  });

  app.post("/api/posts/:id/like", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      await storage.togglePostLike(req.params.id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error toggling like:", error);
      res.status(500).json({ message: "Failed to toggle like" });
    }
  });

  app.post("/api/posts/:id/comment", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { content } = req.body;
      
      if (!content) {
        return res.status(400).json({ message: "Comment content is required" });
      }
      
      await storage.addPostComment({
        postId: req.params.id,
        userId,
        content,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error adding comment:", error);
      res.status(500).json({ message: "Failed to add comment" });
    }
  });

  // Study group routes
  app.get("/api/study-groups", isAuthenticated, async (req, res) => {
    try {
      const groups = await storage.getStudyGroups();
      res.json(groups);
    } catch (error) {
      console.error("Error fetching study groups:", error);
      res.status(500).json({ message: "Failed to fetch study groups" });
    }
  });

  app.post("/api/study-groups", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const groupData = insertStudyGroupSchema.parse({ 
        ...req.body, 
        creatorId: userId 
      });
      
      const group = await storage.createStudyGroup(groupData);
      res.json(group);
    } catch (error) {
      console.error("Error creating study group:", error);
      res.status(500).json({ message: "Failed to create study group" });
    }
  });

  app.post("/api/study-groups/:id/join", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      await storage.joinStudyGroup(req.params.id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error joining study group:", error);
      res.status(500).json({ message: "Failed to join study group" });
    }
  });

  // File upload route
  app.post("/api/upload", isAuthenticated, upload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      res.json({
        success: true,
        filename: req.file.originalname,
        size: req.file.size,
        message: "File uploaded successfully",
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  // User progress routes
  app.get("/api/user/achievements", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const achievements = await storage.getUserAchievements(userId);
      res.json(achievements);
    } catch (error) {
      console.error("Error fetching achievements:", error);
      res.status(500).json({ message: "Failed to fetch achievements" });
    }
  });

  app.get("/api/user/quiz-attempts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const attempts = await storage.getUserQuizAttempts(userId);
      res.json(attempts);
    } catch (error) {
      console.error("Error fetching quiz attempts:", error);
      res.status(500).json({ message: "Failed to fetch quiz attempts" });
    }
  });

  app.get("/api/leaderboard", isAuthenticated, async (req: any, res) => {
    try {
      const leaderboard = await storage.getLeaderboard();
      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  app.get("/api/user/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const stats = await storage.getUserStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ message: "Failed to fetch user stats" });
    }
  });
  
  app.get('/api/youtube/search', isAuthenticated, async (req, res) => {
    try {
      const { q } = req.query;
      if (typeof q !== 'string') {
        return res.status(400).json({ message: 'Query parameter "q" is required.' });
      }
      const videos = await searchYoutubeVideos(q);
      res.json(videos);
    } catch (error) {
      console.error('Error searching YouTube:', error);
      res.status(500).json({ message: 'Failed to search YouTube videos' });
    }
  });

  app.get("/api/user/completed-quizzes-count", isAuthenticated, async (req: any, res) => {
    try {
        const userId = getUserId(req);
        const count = await storage.getCompletedQuizzesCount(userId);
        res.json({ count });
    } catch (error) {
        console.error("Error fetching completed quizzes count:", error);
        res.status(500).json({ message: "Failed to fetch completed quizzes count" });
    }
  });

  app.get("/api/user/completed-topics-count", isAuthenticated, async (req: any, res) => {
    try {
        const userId = getUserId(req);
        const count = await storage.getCompletedTopicsCount(userId);
        res.json({ count });
    } catch (error) {
        console.error("Error fetching completed topics count:", error);
        res.status(500).json({ message: "Failed to fetch completed topics count" });
    }
  });

  const httpServer = createServer(app);

  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws) => {
    console.log("WebSocket client connected");
    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());
        switch (data.type) {
          case "join_study_group":
            wss.clients.forEach((client) => {
              if (client !== ws && client.readyState === 1) { // WebSocket.OPEN
                client.send(JSON.stringify({
                  type: "study_group_update",
                  data: data.payload,
                }));
              }
            });
            break;
            
          case "learning_progress":
            wss.clients.forEach((client) => {
              if (client !== ws && client.readyState === 1) {
                client.send(JSON.stringify({
                  type: "progress_update",
                  data: data.payload,
                }));
              }
            });
            break;
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    });
    ws.on("close", () => console.log("WebSocket client disconnected"));
  });

  return httpServer;
}

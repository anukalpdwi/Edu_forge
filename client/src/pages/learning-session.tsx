import { useState, useEffect, useRef } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import {
  Brain,
  Youtube,
  Send,
  Loader2,
  ArrowLeft,
  RefreshCw,
  Copy,
  PlusCircle,
  FlipVertical,
  BookOpen,
  Sparkles
} from "lucide-react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Interfaces
interface Topic {
  id: string;
  title: string;
  content: string;
}

interface ChatMessage {
  role: "user" | "model";
  parts: { text: string }[];
}

interface Flashcard {
  id: string;
  front: string;
  back: string;
}

interface YoutubeVideo {
  id: string;
  title: string;
  thumbnail: string;
  channel: string;
  duration: string;
}

// Helper Components
function YoutubeCard({ video }: { video: YoutubeVideo }) {
  return (
    <a
      href={`https://www.youtube.com/watch?v=${video.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start space-x-3 p-2 rounded-lg hover:bg-muted transition-colors"
    >
      <div className="relative flex-shrink-0">
        <img src={video.thumbnail} alt={video.title} className="w-28 h-16 rounded-md object-cover" />
        <span className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
          {video.duration}
        </span>
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-medium line-clamp-2 leading-tight">{video.title}</h3>
        <p className="text-xs text-muted-foreground mt-1">{video.channel}</p>
      </div>
    </a>
  );
}

function VideoSkeleton() {
  return (
    <div className="flex items-start space-x-3 p-2">
       <Skeleton className="w-28 h-16 rounded-md flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

function FlashcardComponent({ card }: { card: Flashcard }) {
    const [isFlipped, setIsFlipped] = useState(false);
  
    return (
      <div className="w-full h-48 perspective-[1000px]">
        <div
          className={`relative w-full h-full transform-style-3d transition-transform duration-500 ${isFlipped ? 'rotate-y-180' : ''}`}
          onClick={() => setIsFlipped(!isFlipped)}
        >
          {/* Front */}
          <div className="absolute w-full h-full backface-hidden flex items-center justify-center p-4 text-center bg-card border rounded-lg">
            <p>{card.front}</p>
          </div>
          {/* Back */}
          <div className="absolute w-full h-full backface-hidden rotate-y-180 flex items-center justify-center p-4 text-center bg-primary text-primary-foreground rounded-lg">
            <p>{card.back}</p>
          </div>
        </div>
      </div>
    );
  }

function FlashcardSkeleton() {
    return <Skeleton className="w-full h-48 rounded-lg" />
}


export default function LearningSession() {
  const [, params] = useRoute("/learn/:topicId");
  const topicId = params?.topicId;
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const { data: topic, isLoading: topicLoading } = useQuery<Topic>({
    queryKey: [`/api/topics/${topicId}`],
    enabled: !!topicId,
  });

  const { data: videos, isLoading: videosLoading } = useQuery<YoutubeVideo[]>({
    queryKey: [`/api/youtube/search?q=${topic?.title}`],
    enabled: !!topic,
  });

  const { data: flashcards, isLoading: flashcardsLoading } = useQuery<Flashcard[]>({
    queryKey: [`/api/topics/${topicId}/flashcards`],
    enabled: !!topicId,
  });

  const chatMutation = useMutation({
    mutationFn: (question: string) =>
      apiRequest("POST", "/api/ai/chat", {
        question,
        topicTitle: topic?.title,
        topicContent: topic?.content,
        history: chatHistory,
      }).then(res => res.json()),
    onSuccess: (data, variables) => {
      setChatHistory(prev => [
        ...prev.filter(m => m.parts[0].text !== 'Thinking...'),
        { role: 'user', parts: [{ text: variables }] },
        { role: 'model', parts: [{ text: data.answer }] }
      ]);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "The AI assistant is having trouble responding. Please try again.",
        variant: "destructive"
      });
      setChatHistory(prev => prev.filter(m => m.parts[0].text !== 'Thinking...'));
    }
  });

  const generateFlashcardsMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/ai/flashcards", {
        topic: topic?.title,
        topicId: topic?.id,
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: [`/api/topics/${topicId}/flashcards`]});
      toast({
        title: "Flashcards Generated!",
        description: "Your new flashcards are ready for review."
      });
    }
  });

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatMutation.isPending) return;
    setChatHistory(prev => [...prev, { role: 'user', parts: [{ text: chatInput.trim() }] }, { role: 'model', parts: [{ text: 'Thinking...' }] }]);
    chatMutation.mutate(chatInput.trim());
    setChatInput("");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard!" });
  };
  

  if (topicLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin" /></div>;
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-background">
      <Navbar />
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left Panel: YouTube Videos */}
          <ResizablePanel defaultSize={20} minSize={15}>
            <div className="flex flex-col h-full p-4">
              <h2 className="text-lg font-semibold flex items-center mb-4"><Youtube className="w-5 h-5 mr-2 text-red-500" /> Suggested Videos</h2>
              <ScrollArea className="flex-1">
                <div className="space-y-3 pr-4">
                {videosLoading ? [...Array(4)].map((_, i) => <VideoSkeleton key={i} />)
                : videos?.map(video => <YoutubeCard key={video.id} video={video} />)
                }
                </div>
              </ScrollArea>
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />

          {/* Middle Panel: AI Chatbot */}
          <ResizablePanel defaultSize={55} minSize={30}>
            <div className="flex flex-col h-full">
              <div className="p-4 border-b">
                <Link href="/" className="flex items-center text-sm text-muted-foreground hover:text-primary mb-2">
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
                </Link>
                <h1 className="text-xl font-bold">{topic?.title}</h1>
              </div>
              <ScrollArea className="flex-1 bg-muted/30 p-4" ref={chatContainerRef}>
                <div className="space-y-6">
                  {/* Initial Message */}
                  <div className="flex items-start gap-3">
                    <Avatar className="w-8 h-8 border-2 border-primary">
                       <AvatarImage src="https://logowik.com/content/uploads/images/google-ai-gemini91216.logowik.com.webp" />
                      <AvatarFallback className="bg-primary text-white text-xs">AI</AvatarFallback>
                    </Avatar>
                    <div className="bg-background rounded-lg p-3 max-w-[80%] shadow-sm">
                      <p className="text-sm">Hello! I'm your AI learning assistant for <strong>{topic?.title}</strong>. Ask me anything about this topic to deepen your understanding.</p>
                    </div>
                  </div>

                  {/* Chat History */}
                  {chatHistory.map((message, index) => (
                    <div key={index} className={`flex items-start gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
                       {message.role === 'model' && (
                         <Avatar className="w-8 h-8 border-2 border-primary">
                           <AvatarImage src="https://logowik.com/content/uploads/images/google-ai-gemini91216.logowik.com.webp" />
                           <AvatarFallback className="bg-primary text-white text-xs">AI</AvatarFallback>
                         </Avatar>
                       )}
                       <div className={`rounded-lg p-3 max-w-[80%] shadow-sm ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-background'}`}>
                         {message.parts[0].text === 'Thinking...' ? (
                           <div className="flex items-center space-x-2">
                             <Loader2 className="w-4 h-4 animate-spin"/>
                             <span>Thinking...</span>
                           </div>
                         ) : (
                           <p className="text-sm whitespace-pre-wrap">{message.parts[0].text}</p>
                         )}
                         {message.role === 'model' && message.parts[0].text !== 'Thinking...' && (
                            <div className="flex justify-end mt-2">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(message.parts[0].text)}>
                                    <Copy className="h-3 w-3" />
                                </Button>
                            </div>
                         )}
                       </div>
                       {message.role === 'user' && (
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={user?.profileImageUrl} />
                          <AvatarFallback>{user?.firstName?.[0]}</AvatarFallback>
                        </Avatar>
                       )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="p-4 border-t">
                <form onSubmit={handleChatSubmit} className="flex items-center gap-3">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={`Ask about ${topic?.title}...`}
                    className="flex-1"
                    disabled={chatMutation.isPending}
                  />
                  <Button type="submit" disabled={!chatInput.trim() || chatMutation.isPending}>
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />

          {/* Right Panel: Flashcards */}
          <ResizablePanel defaultSize={25} minSize={15}>
            <div className="flex flex-col h-full p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center"><BookOpen className="w-5 h-5 mr-2 text-primary" /> Flashcards</h2>
                <Tooltip>
                    <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => generateFlashcardsMutation.mutate()} disabled={generateFlashcardsMutation.isPending}>
                        {generateFlashcardsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4" />}
                    </Button>
                    </TooltipTrigger>
                    <TooltipContent>Generate New Flashcards</TooltipContent>
                </Tooltip>
              </div>
              <ScrollArea className="flex-1">
                <div className="space-y-4 pr-4">
                  {flashcardsLoading ? [...Array(3)].map((_, i) => <FlashcardSkeleton key={i} />)
                  : flashcards && flashcards.length > 0 ? flashcards.map(card => <FlashcardComponent key={card.id} card={card} />)
                  : (
                    <Card className="h-48 flex flex-col items-center justify-center text-center text-muted-foreground p-4">
                        <PlusCircle className="w-8 h-8 mb-2" />
                        <p className="text-sm font-medium">No flashcards yet!</p>
                        <p className="text-xs">Click the ✨ button to generate some with AI.</p>
                    </Card>
                  )
                  }
                </div>
              </ScrollArea>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import {
  Heart,
  MessageCircle,
  Share2,
  TrendingUp,
  Award,
  Users,
  Loader2,
  Trophy,
  Star,
  Flame,
  BookOpen,
  Target,
  Clock,
} from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";

interface User {
  id: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  level?: number;
  xp?: number;
  streak?: number;
}

interface Post {
  id: string;
  content: string;
  type: string;
  metadata?: any;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  user: User;
}

interface Achievement {
  id: string;
  type: string;
  title: string;
  description?: string;
  earnedAt: string;
  userId: string;
}

export default function Community() {
  const [newPost, setNewPost] = useState("");
  const [activeTab, setActiveTab] = useState("feed");
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const queryClient = useQueryClient();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Fetch feed posts

  // Fetch feed posts
  const { data: posts, isLoading: postsLoading } = useQuery({
    queryKey: ["/api/feed"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/feed");
      if (!res.ok) throw new Error("Failed to fetch feed");
      return res.json();
    },
  });

  // Fetch user achievements
  const { data: achievements, isLoading: achievementsLoading } = useQuery({
    queryKey: ["/api/user/achievements"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/user/achievements");
      if (!res.ok) throw new Error("Failed to fetch achievements");
      return res.json();
    },
  });

  // Fetch leaderboard
  const { data: leaderboardData = [], isLoading: leaderboardLoading } = useQuery<User[]>({
    queryKey: ["/api/leaderboard"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/leaderboard");
      if (!res.ok) throw new Error("Failed to fetch leaderboard");
      return res.json();
    },
  });

  // Fetch user stats
  const { data: userStats, isLoading: userStatsLoading } = useQuery({
    queryKey: ["/api/user/stats"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/user/stats");
      if (!res.ok) throw new Error("Failed to fetch user stats");
      return res.json();
    },
  });


  // Create post mutation
  const createPostMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest("POST", "/api/posts", {
        content,
        type: "general",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
      setNewPost("");
      toast({
        title: "Post Shared",
        description: "Your post has been shared with the community!",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to share post. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Like post mutation
  const likePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const response = await apiRequest("POST", `/api/posts/${postId}/like`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
    },
  });

  const getInitials = (user: User) => {
    const first = user.firstName?.[0] || "";
    const last = user.lastName?.[0] || "";
    return (first + last).toUpperCase() || "U";
  };

  const handleSharePost = () => {
    if (!newPost.trim()) {
      toast({
        title: "Error",
        description: "Please enter some content to share.",
        variant: "destructive",
      });
      return;
    }

    createPostMutation.mutate(newPost);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Learning Community</h1>
          <p className="text-muted-foreground">
            Share your progress, celebrate achievements, and connect with fellow learners
          </p>
        </div>

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="feed" data-testid="tab-feed">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Feed
                </TabsTrigger>
                <TabsTrigger value="trending" data-testid="tab-trending">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Trending
                </TabsTrigger>
                <TabsTrigger value="achievements" data-testid="tab-achievements">
                  <Award className="mr-2 h-4 w-4" />
                  Achievements
                </TabsTrigger>
              </TabsList>

              <TabsContent value="feed" className="space-y-6">
                {/* Post Creation */}
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-start space-x-4">
                      <Avatar>
                        <AvatarImage src={user?.profileImageUrl || undefined} />
                        <AvatarFallback className="bg-primary text-white">
                          {user ? getInitials(user) : "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <Textarea
                          placeholder="Share your learning journey, ask questions, or celebrate achievements..."
                          value={newPost}
                          onChange={(e) => setNewPost(e.target.value)}
                          className="min-h-20 resize-none"
                          data-testid="textarea-new-post"
                        />
                        <div className="flex justify-between items-center mt-4">
                          <div className="text-sm text-muted-foreground">
                            Share your progress with the community
                          </div>
                          <Button
                            onClick={handleSharePost}
                            disabled={createPostMutation.isPending}
                            data-testid="button-share-post"
                          >
                            {createPostMutation.isPending ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            Share
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Feed Posts */}
                <div className="space-y-6">
                  {postsLoading ? (
                    [...Array(3)].map((_, i) => (
                      <Card key={i}>
                        <CardContent className="p-6">
                          <div className="flex items-start space-x-4">
                            <div className="shimmer w-10 h-10 rounded-full" />
                            <div className="flex-1 space-y-2">
                              <div className="shimmer h-4 w-32 rounded" />
                              <div className="shimmer h-16 w-full rounded" />
                              <div className="shimmer h-4 w-48 rounded" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : !posts || posts.length === 0 ? (
                    <Card>
                      <CardContent className="p-12 text-center">
                        <MessageCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                        <h3 className="text-lg font-semibold mb-2">No Posts Yet</h3>
                        <p className="text-muted-foreground">
                          Be the first to share your learning progress with the community!
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    (posts as Post[]).map((post) => (
                      <Card key={post.id} className="learning-card">
                        <CardContent className="p-6">
                          <div className="flex items-start space-x-4">
                            <Avatar>
                              <AvatarImage src={post.user.profileImageUrl || undefined} />
                              <AvatarFallback className="bg-secondary text-white">
                                {getInitials(post.user)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <span className="font-semibold" data-testid={`text-user-${post.id}`}>
                                  {post.user.firstName || "Anonymous"} {post.user.lastName || ""}
                                </span>
                                {post.user.level && (
                                  <Badge variant="outline" className="text-xs">
                                    Level {post.user.level}
                                  </Badge>
                                )}
                                <span className="text-muted-foreground text-sm">
                                  {formatDistanceToNow(new Date(post.createdAt))} ago
                                </span>
                              </div>
                              <p className="mb-4" data-testid={`text-content-${post.id}`}>
                                {post.content}
                              </p>
                              <div className="flex items-center space-x-6 text-muted-foreground">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto p-0 hover:text-accent"
                                  onClick={() => likePostMutation.mutate(post.id)}
                                  data-testid={`button-like-${post.id}`}
                                >
                                  <Heart className="mr-2 h-4 w-4" />
                                  {post.likeCount} likes
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto p-0 hover:text-primary"
                                  data-testid={`button-comment-${post.id}`}
                                >
                                  <MessageCircle className="mr-2 h-4 w-4" />
                                  {post.commentCount} comments
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto p-0 hover:text-secondary"
                                  data-testid={`button-share-${post.id}`}
                                >
                                  <Share2 className="h-4 w-4 mr-2" />
                                  Share
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="trending" className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="bg-gradient-to-br from-primary/10 to-secondary/10">
                    <CardContent className="p-6">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                          <TrendingUp className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold">Trending Topic</h3>
                          <p className="text-sm text-muted-foreground">Machine Learning</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        Join 1,247 learners exploring ML fundamentals this week
                      </p>
                      <Button size="sm" data-testid="button-join-trending">
                        Join Discussion
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-success/10 to-emerald-100/50">
                    <CardContent className="p-6">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="w-10 h-10 bg-success rounded-lg flex items-center justify-center">
                          <BookOpen className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold">Popular Course</h3>
                          <p className="text-sm text-muted-foreground">React Development</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        Most completed course this month with 89% success rate
                      </p>
                      <Button size="sm" variant="outline" data-testid="button-start-course">
                        Start Learning
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Weekly Challenges</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Target className="h-8 w-8 text-primary" />
                        <div>
                          <h4 className="font-semibold">Complete 5 Quiz Attempts</h4>
                          <p className="text-sm text-muted-foreground">Earn 100 XP</p>
                        </div>
                      </div>
                      <Badge>3/5 Done</Badge>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Users className="h-8 w-8 text-secondary" />
                        <div>
                          <h4 className="font-semibold">Join a Study Group</h4>
                          <p className="text-sm text-muted-foreground">Earn 50 XP</p>
                        </div>
                      </div>
                      <Badge variant="outline">Pending</Badge>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="achievements" className="space-y-6">
                {achievementsLoading ? (
                  <div className="grid md:grid-cols-2 gap-4">
                    {[...Array(4)].map((_, i) => (
                      <Card key={i}>
                        <CardContent className="p-6">
                          <div className="shimmer h-12 w-12 rounded-lg mb-4" />
                          <div className="shimmer h-6 w-32 rounded mb-2" />
                          <div className="shimmer h-4 w-full rounded" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : !achievements || achievements.length === 0 ? (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <Award className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <h3 className="text-lg font-semibold mb-2">No Achievements Yet</h3>
                      <p className="text-muted-foreground">
                        Start learning to unlock your first achievement!
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {(achievements as Achievement[]).map((achievement) => (
                      <Card key={achievement.id} className="learning-card">
                        <CardContent className="p-6">
                          <div className="flex items-start space-x-4">
                            <div className="w-12 h-12 bg-warning rounded-lg flex items-center justify-center">
                              <Trophy className="h-6 w-6 text-white" />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-semibold mb-1">{achievement.title}</h4>
                              {achievement.description && (
                                <p className="text-sm text-muted-foreground mb-2">
                                  {achievement.description}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                Earned {formatDistanceToNow(new Date(achievement.earnedAt))} ago
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* User Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                    <Star className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold" data-testid="text-user-xp">
                      {user?.xp || 0} XP
                    </p>
                    <p className="text-muted-foreground text-sm">Total Experience</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-warning rounded-full flex items-center justify-center">
                    <Flame className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold" data-testid="text-user-streak">
                      {user?.streak || 0} Days
                    </p>
                    <p className="text-muted-foreground text-sm">Learning Streak</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
                    <Trophy className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold" data-testid="text-user-level">
                      Level {user?.level || 1}
                    </p>
                    <p className="text-muted-foreground text-sm">Current Level</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Leaderboard */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Weekly Leaderboard</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {leaderboardLoading ? (
                    [...Array(5)].map((_, i) => (
                      <div key={i} className="flex items-center space-x-3 p-2 rounded-lg">
                        <div className="shimmer w-6 h-6 rounded-full" />
                        <div className="shimmer w-8 h-8 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <div className="shimmer h-4 w-24 rounded" />
                          <div className="shimmer h-3 w-32 rounded" />
                        </div>
                      </div>
                    ))
                  ) : (
                    leaderboardData?.map((learner, index) => (
                      <div key={learner.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted transition-colors">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? 'bg-warning text-white' :
                          index === 1 ? 'bg-muted-foreground text-white' :
                          index === 2 ? 'bg-accent text-white' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {index + 1}
                        </div>
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={learner.profileImageUrl || undefined} />
                          <AvatarFallback className="bg-primary text-white text-xs">
                            {getInitials(learner)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{learner.firstName} {learner.lastName}</p>
                          <p className="text-xs text-muted-foreground">
                            {(learner.xp ?? 0).toLocaleString()} XP • Level {learner.level}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
              {userStatsLoading ? (
                <>
                  <div className="shimmer h-4 w-full rounded" />
                  <div className="shimmer h-4 w-full rounded" />
                  <div className="shimmer h-4 w-full rounded" />
                  <div className="shimmer h-4 w-full rounded" />
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="h-4 w-4 text-success" />
                      <span className="text-sm">Average Score</span>
                    </div>
                    <span className="font-semibold">{typeof userStats?.averageScore === 'number' ? userStats.averageScore.toFixed(2) : '0.00'}%</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Target className="h-4 w-4 text-primary" />
                      <span className="text-sm">Sessions Completed</span>
                    </div>
                    <span className="font-semibold">{userStats?.sessionsCompleted ?? 0}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-secondary" />
                      <span className="text-sm">Total Practice Time</span>
                    </div>
                    <span className="font-semibold">{typeof userStats?.totalPracticeTime === 'number' ? (userStats.totalPracticeTime / 60).toFixed(1) : '0.0'} hrs</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Award className="h-4 w-4 text-warning" />
                      <span className="text-sm">Best Performance</span>
                    </div>
                    <span className="font-semibold">{typeof userStats?.bestPerformance === 'number' ? userStats.bestPerformance : 0}%</span>
                  </div>
                </>
              )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
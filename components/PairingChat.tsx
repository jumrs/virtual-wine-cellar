"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Wine, UtensilsCrossed, Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function PairingChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error("Not authenticated");
      }

      const response = await fetch("/api/pair", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ meal: input }),
      });

      if (!response.ok) {
        throw new Error("Failed to get pairing suggestions");
      }

      const data = await response.json();
      const assistantMessage: Message = {
        role: "assistant",
        content: data.suggestion || "I couldn't find a suitable pairing. Try describing your meal in more detail.",
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to get pairing suggestions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const suggestedQueries = [
    "Grilled steak with mushrooms",
    "Fresh seafood pasta",
    "Cheese board selection",
    "Spicy Thai curry",
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] relative">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none overflow-hidden">
        <div className="absolute top-20 right-10 w-40 h-40 border border-primary rounded-full" />
        <div className="absolute bottom-40 left-10 w-32 h-32 border border-primary rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border border-primary rounded-full" />
      </div>
      
      <div className="relative z-10 flex flex-col h-full">
      {/* Elegant Sommelier Header */}
      <div className="relative wine-card p-6 mb-4 overflow-hidden bg-gradient-to-br from-card to-card/95">
        {/* Decorative wine elements */}
        <div className="absolute top-0 right-0 w-32 h-32 opacity-[0.03] pointer-events-none">
          <div className="absolute top-4 right-8 w-12 h-20 border-2 border-primary rounded-t-lg rounded-b-2xl" />
          <div className="absolute top-12 right-4 w-8 h-12 border-2 border-primary rounded-t-full" />
        </div>
        
        <div className="relative flex items-center gap-4">
          {/* Sommelier Avatar */}
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/30 flex items-center justify-center shadow-lg">
              {/* Sommelier icon representation */}
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Wine className="w-6 h-6 text-primary" />
                </div>
                {/* Bow tie accent */}
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-2 bg-primary/30 rounded-sm" />
              </div>
            </div>
            {/* Status indicator */}
            <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-card shadow-sm" />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-semibold font-serif text-2xl text-foreground">Your Sommelier</h2>
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              At your service • Ready to pair
            </p>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1 w-1 rounded-full bg-primary animate-pulse" />
              <span className="text-xs text-muted-foreground italic">Expert wine pairing guidance</span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto space-y-6 mb-4 min-h-0 px-1">
        {messages.length === 0 ? (
          <div className="text-center py-12 px-4">
            {/* Elegant welcome illustration */}
            <div className="relative mx-auto mb-6 w-32 h-32">
              {/* Wine bottle and glass illustration */}
              <div className="absolute left-1/2 top-0 -translate-x-1/2">
                {/* Wine bottle */}
                <div className="relative w-8 h-16 mx-auto">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-12 border-2 border-primary/40 rounded-t-lg rounded-b-2xl bg-gradient-to-b from-primary/5 to-transparent" />
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-4 h-3 border border-primary/30 rounded-sm bg-card" />
                  <div className="absolute top-12 left-1/2 -translate-x-1/2 w-1 h-4 bg-primary/20" />
                </div>
                {/* Wine glass */}
                <div className="absolute top-8 left-1/2 translate-x-8">
                  <div className="relative">
                    <div className="w-6 h-8 border-2 border-primary/40 rounded-t-full border-b-0 bg-gradient-to-b from-primary/5 to-transparent" />
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-3 bg-primary/30" />
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-2 h-0.5 bg-primary/30 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
            
            <h3 className="font-serif text-2xl font-semibold mb-3 text-foreground">
              Good evening, how may I assist you?
            </h3>
            <p className="text-sm text-muted-foreground mb-2 max-w-md mx-auto leading-relaxed">
              I&apos;m here to help you find the perfect wine pairing from your collection.
            </p>
            <p className="text-xs text-muted-foreground mb-8 italic">
              Simply describe what you&apos;re preparing, and I&apos;ll suggest the ideal match.
            </p>
            
            {/* Suggested Queries - Elegant style */}
            <div className="flex flex-wrap justify-center gap-3 max-w-lg mx-auto">
              {suggestedQueries.map((query, index) => (
                <button
                  key={index}
                  onClick={() => setInput(query)}
                  className="group px-5 py-2.5 rounded-full bg-muted/50 hover:bg-primary/10 border border-border/50 hover:border-primary/30 text-sm font-medium transition-all duration-200 hover:shadow-sm"
                >
                  <span className="flex items-center gap-2">
                    <UtensilsCrossed className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                    {query}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={cn(
                "flex animate-fade-in-up",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div className={cn(
                "flex items-start gap-3 max-w-[80%]",
                message.role === "user" && "flex-row-reverse"
              )}>
                {/* Avatar */}
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm",
                  message.role === "user" 
                    ? "bg-primary text-primary-foreground ring-2 ring-primary/20" 
                    : "bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20"
                )}>
                  {message.role === "user" ? (
                    <UtensilsCrossed className="w-5 h-5" />
                  ) : (
                    <Wine className="w-5 h-5 text-primary" />
                  )}
                </div>
                
                {/* Message Bubble */}
                <div
                  className={cn(
                    "rounded-2xl px-5 py-4 shadow-sm",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-card border border-border/50 rounded-tl-sm"
                  )}
                >
                  {message.role === "assistant" && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-primary/80">Sommelier</span>
                      <div className="h-0.5 w-0.5 rounded-full bg-primary/40" />
                    </div>
                  )}
                  <p className={cn(
                    "text-sm whitespace-pre-wrap leading-relaxed",
                    message.role === "user" ? "text-primary-foreground" : "text-foreground"
                  )}>
                    {message.content}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
        
        {loading && (
          <div className="flex justify-start animate-fade-in-up">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 flex items-center justify-center shadow-sm">
                <Wine className="w-5 h-5 text-primary" />
              </div>
              <div className="bg-card border border-border/50 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-muted-foreground">Consulting the cellar</span>
                    <span className="flex gap-0.5">
                      <span className="w-1 h-1 rounded-full bg-primary/60 animate-pulse" style={{ animationDelay: '0ms' }} />
                      <span className="w-1 h-1 rounded-full bg-primary/60 animate-pulse" style={{ animationDelay: '150ms' }} />
                      <span className="w-1 h-1 rounded-full bg-primary/60 animate-pulse" style={{ animationDelay: '300ms' }} />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Elegant Input Area */}
      <div className="wine-card p-4 border-t border-border/30 bg-gradient-to-t from-card to-card/50">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="Tell me about your meal..."
              disabled={loading}
              className="elegant-input flex-1 h-12 pr-12 border border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
            />
            <UtensilsCrossed className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
          <Button 
            onClick={handleSend} 
            disabled={loading || !input.trim()}
            size="lg"
            className="rounded-xl h-12 px-6 btn-wine shadow-lg shadow-primary/20 disabled:opacity-50 disabled:shadow-none"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center italic">
          Press Enter to send
        </p>
      </div>
      </div>
    </div>
  );
}

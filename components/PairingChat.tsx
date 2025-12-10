"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Wine, Sparkles, UtensilsCrossed } from "lucide-react";
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
        },
        body: JSON.stringify({ meal: input, accessToken }),
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
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      {/* Header Card */}
      <div className="wine-card p-6 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold font-serif text-xl">AI Sommelier</h2>
            <p className="text-sm text-muted-foreground">
              Get perfect wine pairings from your cellar
            </p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 min-h-0">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <UtensilsCrossed className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-2">What are you eating?</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Describe your meal and I&apos;ll suggest the perfect wine from your collection
            </p>
            
            {/* Suggested Queries */}
            <div className="flex flex-wrap justify-center gap-2">
              {suggestedQueries.map((query, index) => (
                <button
                  key={index}
                  onClick={() => setInput(query)}
                  className="px-4 py-2 rounded-full bg-muted hover:bg-muted/80 text-sm transition-colors"
                >
                  {query}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={cn(
                "flex",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div className={cn(
                "flex items-start gap-3 max-w-[85%]",
                message.role === "user" && "flex-row-reverse"
              )}>
                {/* Avatar */}
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                  message.role === "user" 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted"
                )}>
                  {message.role === "user" ? (
                    <UtensilsCrossed className="w-4 h-4" />
                  ) : (
                    <Wine className="w-4 h-4" />
                  )}
                </div>
                
                {/* Message Bubble */}
                <div
                  className={cn(
                    "rounded-2xl px-4 py-3",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted rounded-tl-sm"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {message.content}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
        
        {loading && (
          <div className="flex justify-start">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <Wine className="w-4 h-4" />
              </div>
              <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Finding the perfect pairing...</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="wine-card p-3">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            placeholder="Describe your meal..."
            disabled={loading}
            className="elegant-input flex-1"
          />
          <Button 
            onClick={handleSend} 
            disabled={loading || !input.trim()}
            className="rounded-xl h-11 px-4 btn-wine"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

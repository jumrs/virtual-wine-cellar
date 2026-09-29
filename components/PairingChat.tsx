"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Wine, UtensilsCrossed } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import { useCellar } from "@/components/CellarProvider";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function PairingChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { activeCellar } = useCellar();

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    if (!activeCellar) {
      toast({
        title: "No cellar selected",
        description: "Select a cellar to get pairing suggestions.",
        variant: "destructive",
      });
      return;
    }

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
        body: JSON.stringify({ meal: input, cellarId: activeCellar.id }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Failed to get pairing suggestions");
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
        description:
          error instanceof Error && error.message
            ? error.message
            : "Failed to get pairing suggestions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const suggestedQueries = [
    "Grilled steak",
    "Seafood pasta",
    "Cheese board",
    "Thai curry",
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-15rem)] md:h-[calc(100vh-13rem)] relative">
      <div className="relative z-10 flex flex-col h-full">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 min-h-0 px-1">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-8 px-4">
              {/* Elegant Sommelier Icon */}
              <div className="relative mb-6">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center shadow-lg border border-primary/20">
                  {/* Sommelier silhouette using CSS */}
                  <div className="relative">
                    {/* Head */}
                    <div className="w-6 h-6 rounded-full bg-primary/80 absolute -top-3 left-1/2 -translate-x-1/2" />
                    {/* Body */}
                    <div className="w-8 h-10 bg-primary/80 rounded-t-lg mt-4" />
                    {/* Wine glass in hand */}
                    <div className="absolute -right-4 top-2">
                      <Wine className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                </div>
                {/* Decorative ring */}
                <div className="absolute inset-0 rounded-full border-2 border-primary/10 scale-110" />
              </div>

              <h3 className="font-serif text-xl font-semibold mb-2 text-foreground">
                Your Sommelier
              </h3>
              <p className="text-sm text-muted-foreground mb-6 text-center max-w-xs">
                Describe your meal and I&apos;ll suggest the perfect wine from your cellar.
              </p>

              {/* Suggested Queries */}
              <div className="flex flex-wrap justify-center gap-2 max-w-sm">
                {suggestedQueries.map((query, index) => (
                  <button
                    key={index}
                    onClick={() => setInput(query)}
                    className="px-4 py-2 rounded-full bg-muted/50 hover:bg-primary/10 border border-border/50 hover:border-primary/30 text-sm transition-all duration-200"
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
                  "flex animate-fade-in-up",
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
                      : "bg-primary/10 border border-primary/20"
                  )}>
                    {message.role === "user" ? (
                      <UtensilsCrossed className="w-4 h-4" />
                    ) : (
                      <Wine className="w-4 h-4 text-primary" />
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-3",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-card border border-border/50 rounded-tl-sm"
                    )}
                  >
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
                <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Wine className="w-4 h-4 text-primary" />
                </div>
                <div className="bg-card border border-border/50 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Thinking...</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-border/30 bg-card/50 pb-8 md:pb-4">
          <div className="flex gap-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="What are you having?"
              disabled={loading}
              className="flex-1 h-12 rounded-xl border border-border/50 focus:border-primary/50"
            />
            <Button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              size="lg"
              className="rounded-xl h-12 px-5 btn-wine"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

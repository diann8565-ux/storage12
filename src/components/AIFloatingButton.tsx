
import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "ai";
  content: string;
}

export function AIFloatingButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "ai", content: "Halo! Ada yang bisa saya bantu terkait penyimpanan Anda hari ini?" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          prompt: userMessage,
          pageContext: location.pathname,
          model: 'gemini-2.5-flash'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      setMessages((prev) => [...prev, { role: "ai", content: data.result }]);
    } catch (error) {
      console.error(error);
      toast.error("Maaf, saya sedang mengalami gangguan.");
      setMessages((prev) => [...prev, { role: "ai", content: "Maaf, terjadi kesalahan saat memproses permintaan Anda." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg shadow-blue-500/30 transition-all duration-300 z-50 animate-in zoom-in hover:scale-110",
          isOpen ? "bg-rose-500 hover:bg-rose-600 rotate-90" : "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
        )}
      >
        {isOpen ? <X className="h-6 w-6 text-white" /> : <Bot className="h-8 w-8 text-white" />}
      </Button>

      {/* Chat Window */}
      {isOpen && (
        <Card className="fixed bottom-24 right-6 w-[350px] md:w-[400px] h-[500px] shadow-2xl z-50 flex flex-col bg-slate-900/90 backdrop-blur-xl border-slate-700/50 animate-in slide-in-from-bottom-10 fade-in duration-300 rounded-2xl overflow-hidden ring-1 ring-white/10">
          {/* Header */}
          <CardHeader className="bg-gradient-to-r from-violet-600 to-indigo-600 p-4 border-b border-white/10 flex flex-row items-center gap-3 relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm shadow-inner z-10">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div className="z-10">
              <CardTitle className="text-md text-white font-semibold tracking-wide">AI Assistant</CardTitle>
              <p className="text-xs text-indigo-100/80 flex items-center gap-1.5 mt-0.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]"></span>
                Online • Gemini Flash
              </p>
            </div>
            <Button 
              size="icon" 
              variant="ghost" 
              className="ml-auto text-white/70 hover:text-white hover:bg-white/20 rounded-full h-8 w-8 z-10 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          
          {/* Messages Area */}
          <CardContent className="flex-1 p-0 overflow-hidden relative bg-gradient-to-b from-slate-900/50 to-slate-950/50">
            <ScrollArea className="h-full p-4" ref={scrollRef}>
              <div className="flex flex-col gap-6 pb-4">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex gap-3 max-w-[85%]",
                      msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                    )}
                  >
                    {/* Avatar */}
                    <div className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center shrink-0 shadow-md border border-white/10",
                      msg.role === "user" ? "bg-indigo-600" : "bg-slate-700"
                    )}>
                      {msg.role === "user" ? <User className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-emerald-400" />}
                    </div>

                    {/* Bubble */}
                    <div
                      className={cn(
                        "flex flex-col gap-1 px-4 py-2.5 text-sm shadow-lg",
                        msg.role === "user"
                          ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-2xl rounded-tr-sm"
                          : "bg-slate-800/80 backdrop-blur-md text-slate-100 rounded-2xl rounded-tl-sm border border-white/5"
                      )}
                    >
                      <p className="leading-relaxed">{msg.content}</p>
                      <span className="text-[10px] opacity-50 self-end mt-1">
                        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex gap-3 max-w-[85%] mr-auto">
                    <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0 shadow-md border border-white/10">
                      <Bot className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div className="bg-slate-800/80 backdrop-blur-md text-slate-100 rounded-2xl rounded-tl-sm border border-white/5 px-4 py-4 shadow-lg">
                      <div className="flex gap-1.5 items-center">
                        <span className="w-2 h-2 bg-emerald-400/80 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                        <span className="w-2 h-2 bg-emerald-400/80 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="w-2 h-2 bg-emerald-400/80 rounded-full animate-bounce"></span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>

          {/* Input Area */}
          <CardFooter className="p-3 bg-slate-900 border-t border-white/10 backdrop-blur-xl">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex w-full items-center gap-2 relative"
            >
              <Input
                ref={inputRef}
                placeholder="Ketik pesan..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="bg-slate-950/80 border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 text-slate-100 rounded-xl pr-10 py-5 shadow-inner transition-all placeholder:text-slate-500"
                disabled={isLoading}
              />
              <Button 
                type="submit" 
                size="icon" 
                disabled={isLoading || !input.trim()}
                className={cn(
                  "absolute right-1.5 top-1.5 h-8 w-8 rounded-lg transition-all duration-300",
                  input.trim() 
                    ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25" 
                    : "bg-slate-800 text-slate-500 hover:bg-slate-700"
                )}
              >
                <Send className="h-4 w-4" />
                <span className="sr-only">Kirim</span>
              </Button>
            </form>
          </CardFooter>
        </Card>
      )}
    </>
  );
}

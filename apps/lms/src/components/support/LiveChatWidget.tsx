"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import Link from "next/link";

interface ChatMessage {
  messageId: string;
  senderId: string;
  senderName: string;
  senderRole: "STAFF" | "STUDENT";
  text: string;
  timestamp: string;
}

type ChatState = "IDLE" | "OPEN" | "WAITING" | "ACTIVE" | "CLOSED" | "NO_AGENTS" | "RATING";

export function LiveChatWidget() {
  const [state, setState] = useState<ChatState>("IDLE");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [agentName, setAgentName] = useState("");
  const [ticketNumber, setTicketNumber] = useState("");
  const [typing, setTyping] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:38472";

  const connectSocket = useCallback(() => {
    if (socketRef.current?.connected) return;
    const token = document.cookie
      .split(";").map((c) => c.trim())
      .find((c) => c.startsWith("funt_auth_lms="))
      ?.split("=").slice(1).join("=");

    const socket = io(apiUrl, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      auth: { token },
      withCredentials: true,
    });

    socket.on("connect", () => { /* connected */ });

    socket.on("support:waiting", (data: { ticketId: string; ticketNumber: string }) => {
      setTicketId(data.ticketId);
      setTicketNumber(data.ticketNumber);
      setState("WAITING");
    });

    socket.on("support:no-agents", (data: { ticketId: string; ticketNumber: string }) => {
      setTicketNumber(data.ticketNumber);
      setState("NO_AGENTS");
    });

    socket.on("support:ai-reply", (data: { ticketId: string; text: string; confident: boolean }) => {
      // Show AI response as a message
      setMessages((prev) => [...prev, {
        messageId: `ai-${Date.now()}`,
        senderId: "AI_BOT",
        senderName: "FUNT Bot",
        senderRole: "STAFF",
        text: data.text,
        timestamp: new Date().toISOString(),
      }]);
      if (data.confident) {
        // AI answered confidently — show the response and let student ask more or close
        setAgentName("FUNT Bot");
        setState("ACTIVE");
      }
      // If not confident, the NO_AGENTS event will fire after this
    });

    socket.on("support:connected", (data: { agentName: string }) => {
      setAgentName(data.agentName);
      setState("ACTIVE");
    });

    socket.on("chat:message", (data: ChatMessage) => {
      setMessages((prev) => [...prev, data]);
      setTyping(false);
    });

    socket.on("chat:typing", () => setTyping(true));
    socket.on("chat:stopped-typing", () => setTyping(false));

    socket.on("support:closed", () => {
      setState("RATING");
    });

    socket.on("support:transferred", (data: { toAgent: string }) => {
      setAgentName(data.toAgent);
      setMessages((prev) => [...prev, {
        messageId: `sys-${Date.now()}`,
        senderId: "system",
        senderName: "System",
        senderRole: "STAFF",
        text: `You've been transferred to ${data.toAgent}.`,
        timestamp: new Date().toISOString(),
      }]);
    });

    socket.on("support:error", (data: { error: string }) => {
      console.error("[chat]", data.error);
    });

    socketRef.current = socket;
  }, [apiUrl]);

  useEffect(() => { return () => { socketRef.current?.disconnect(); }; }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  function openChat() { setState("OPEN"); connectSocket(); }

  function sendRequest(message: string) {
    if (!message.trim()) return;
    socketRef.current?.emit("support:request", { message: message.trim() });
    setMessages([{
      messageId: "local-0", senderId: "me", senderName: "You",
      senderRole: "STUDENT", text: message.trim(), timestamp: new Date().toISOString(),
    }]);
  }

  function sendMessage() {
    if (!input.trim() || !ticketId) return;
    socketRef.current?.emit("chat:message", { ticketId, text: input.trim() });
    setInput("");
  }

  function handleInputChange(value: string) {
    setInput(value);
    if (ticketId && value.trim()) {
      socketRef.current?.emit("chat:typing", { ticketId });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socketRef.current?.emit("chat:stopped-typing", { ticketId });
      }, 2000);
    }
  }

  function submitRating(stars: number) {
    setRating(stars);
    setRatingSubmitted(true);
    socketRef.current?.emit("support:rate", { ticketId, rating: stars });
  }

  function resetChat() {
    setState("IDLE");
    setMessages([]); setTicketId(null); setAgentName(""); setTicketNumber("");
    setInput(""); setRating(0); setRatingSubmitted(false);
    socketRef.current?.disconnect();
    socketRef.current = null;
  }

  // ── Floating button ───────────────────────────────────────────────
  if (state === "IDLE") {
    return (
      <button onClick={openChat}
        className="fixed bottom-6 right-6 z-[9999] flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-500 hover:scale-105 active:scale-95"
        aria-label="Contact Support">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>
    );
  }

  // ── Chat window ───────────────────────────────────────────────────
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex h-[500px] w-[360px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-indigo-600 px-4 py-3">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-sm font-semibold text-white">
            {state === "ACTIVE" ? `Chat with ${agentName}` : "Support"}
          </span>
        </div>
        <button onClick={resetChat} className="rounded-lg p-1 text-white/70 hover:bg-white/10 hover:text-white">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {state === "OPEN" && <InitialPrompt onSend={sendRequest} />}

        {state === "WAITING" && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
            <p className="mt-4 text-sm font-medium text-slate-700">Please wait...</p>
            <p className="mt-1 text-xs text-slate-500">We&apos;re assigning a support agent to help you.</p>
            {ticketNumber && <p className="mt-2 text-xs text-slate-400">Ticket: {ticketNumber}</p>}
          </div>
        )}

        {state === "NO_AGENTS" && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="mt-3 text-sm font-medium text-slate-800">No agents available right now</p>
            <p className="mt-1 text-xs text-slate-500">Your message has been saved as a support ticket. We&apos;ll reply soon.</p>
            {ticketNumber && (
              <p className="mt-2 text-xs text-slate-600">Ticket: <span className="font-mono font-bold">{ticketNumber}</span></p>
            )}
            <Link href="/support" onClick={resetChat}
              className="mt-4 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition">
              Track My Tickets
            </Link>
            <button onClick={resetChat} className="mt-2 text-xs text-slate-400 hover:text-slate-600">Close</button>
          </div>
        )}

        {(state === "ACTIVE" || state === "RATING" || state === "CLOSED") && (
          <>
            {messages.map((m) => (
              <div key={m.messageId} className={`flex ${m.senderRole === "STUDENT" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                  m.senderRole === "STUDENT"
                    ? "bg-indigo-600 text-white rounded-br-md"
                    : "bg-slate-100 text-slate-800 rounded-bl-md"
                }`}>{m.text}</div>
              </div>
            ))}
            {typing && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-500 rounded-bl-md">
                  <span className="inline-flex gap-0.5"><span className="animate-bounce">·</span><span className="animate-bounce" style={{animationDelay:"0.1s"}}>·</span><span className="animate-bounce" style={{animationDelay:"0.2s"}}>·</span></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}

        {state === "RATING" && (
          <div className="text-center py-3 border-t border-slate-100 mt-3">
            {!ratingSubmitted ? (
              <>
                <p className="text-sm font-medium text-slate-700">How was your experience?</p>
                <div className="mt-2 flex justify-center gap-1">
                  {[1,2,3,4,5].map((star) => (
                    <button key={star} onClick={() => submitRating(star)}
                      className={`text-2xl transition hover:scale-110 ${star <= rating ? "text-yellow-400" : "text-slate-300"}`}
                      onMouseEnter={() => setRating(star)}>
                      ★
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-slate-400">Click a star to rate</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-emerald-600">Thank you for your feedback!</p>
                <button onClick={resetChat} className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-800">
                  Start new conversation
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      {state === "ACTIVE" && (
        <div className="border-t border-slate-100 bg-white px-3 py-3">
          <div className="flex items-center gap-2">
            <input type="text" value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Type a message..."
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20" />
            <button onClick={sendMessage} disabled={!input.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 transition">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InitialPrompt({ onSend }: { onSend: (msg: string) => void }) {
  const [msg, setMsg] = useState("");
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
      <p className="mt-3 text-sm font-medium text-slate-800">Hi! How can we help you?</p>
      <p className="mt-1 text-xs text-slate-500">Describe your problem below. We&apos;ll assign a support agent to assist you.</p>
      <div className="mt-4 w-full">
        <textarea value={msg} onChange={(e) => setMsg(e.target.value)}
          placeholder="e.g., I can't access my Robotics course..."
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 resize-none focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20"
          rows={3} />
        <button onClick={() => { if (msg.trim()) onSend(msg); }} disabled={!msg.trim()}
          className="mt-3 w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-40">
          Send Message
        </button>
      </div>
    </div>
  );
}

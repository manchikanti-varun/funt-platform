"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useRouter } from "next/navigation";

interface IncomingRequest {
  ticketId: string;
  ticketNumber: string;
  studentName: string;
  studentUsername: string;
  message: string;
  createdAt: string;
}

interface ActiveChat {
  ticketId: string;
  ticketNumber: string;
  studentName: string;
  studentUsername: string;
  subject: string;
}

interface ChatMessage {
  messageId: string;
  ticketId?: string;
  senderId: string;
  senderName?: string;
  senderRole: string;
  text: string;
  timestamp: string;
}

interface OnlineAgent { id: string; name: string; }

const CANNED_RESPONSES = [
  "Let me check that for you.",
  "Can you share your username?",
  "I've fixed the issue, please try again now.",
  "Could you provide more details about the problem?",
  "Please refresh your page and try again.",
  "I'm escalating this to the team. We'll update you shortly.",
  "Is there anything else I can help you with?",
  "Your issue has been resolved. Have a great day!",
];

export default function SupportDashboard() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(false);
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [activeChats, setActiveChats] = useState<ActiveChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [onlineAgents, setOnlineAgents] = useState<OnlineAgent[]>([]);
  const [agentsCount, setAgentsCount] = useState(0);
  const [showCanned, setShowCanned] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [agentName, setAgentName] = useState("");
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedChatRef = useRef<string | null>(null);

  useEffect(() => { selectedChatRef.current = selectedChat; }, [selectedChat]);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:38472";

  const connectSocket = useCallback(() => {
    if (socketRef.current?.connected) return;
    const token = document.cookie
      .split(";").map((c) => c.trim())
      .find((c) => c.startsWith("funt_auth_admin="))
      ?.split("=").slice(1).join("=");

    if (!token) { router.push("/login"); return; }

    const socket = io(apiUrl, {
      path: "/socket.io", transports: ["websocket", "polling"],
      auth: { token }, withCredentials: true,
    });

    socket.on("connect", () => { /* connected */ });
    socket.on("connect_error", () => { router.push("/login"); });
    socket.on("disconnect", () => setIsOnline(false));

    socket.on("support:incoming", (data: IncomingRequest) => {
      setIncoming((prev) => [data, ...prev]);
      playNotification();
      showBrowserNotification(data.studentName, data.message);
    });

    socket.on("support:claimed", (data: { ticketId: string }) => {
      setIncoming((prev) => prev.filter((r) => r.ticketId !== data.ticketId));
    });

    socket.on("support:waiting-list", (data: { requests: IncomingRequest[] }) => setIncoming(data.requests));
    socket.on("support:my-chats", (data: { chats: ActiveChat[] }) => setActiveChats(data.chats));
    socket.on("support:agents-count", (data: { count: number }) => setAgentsCount(data.count));
    socket.on("support:online-agents", (data: { agents: OnlineAgent[] }) => setOnlineAgents(data.agents));

    socket.on("support:accepted", (data: { ticketId: string; studentName: string; ticketNumber: string; studentUsername: string }) => {
      setActiveChats((prev) => [...prev, { ticketId: data.ticketId, ticketNumber: data.ticketNumber, studentName: data.studentName, studentUsername: data.studentUsername ?? "", subject: "" }]);
      setSelectedChat(data.ticketId);
      socket.emit("chat:get-messages", { ticketId: data.ticketId });
    });

    socket.on("support:assigned-to-you", (data: { ticketId: string; ticketNumber: string; studentName: string; transferredFrom: string }) => {
      setActiveChats((prev) => [...prev, { ticketId: data.ticketId, ticketNumber: data.ticketNumber, studentName: data.studentName, studentUsername: "", subject: `From ${data.transferredFrom}` }]);
      playNotification();
    });

    socket.on("chat:messages", (data: { ticketId: string; messages: ChatMessage[] }) => {
      if (data.ticketId === selectedChatRef.current) setMessages(data.messages);
    });

    socket.on("chat:message", (data: ChatMessage) => {
      if (data.ticketId === selectedChatRef.current) { setMessages((prev) => [...prev, data]); setTyping(false); }
    });

    socket.on("chat:typing", () => setTyping(true));
    socket.on("chat:stopped-typing", () => setTyping(false));

    socket.on("support:closed", (data: { ticketId: string }) => {
      setActiveChats((prev) => prev.filter((c) => c.ticketId !== data.ticketId));
      if (selectedChatRef.current === data.ticketId) { setSelectedChat(null); setMessages([]); }
    });

    socket.on("support:rated", (data: { rating: number }) => {
      console.log(`Chat rated ${data.rating}/5`);
    });

    socketRef.current = socket;
  }, [apiUrl, router]);

  useEffect(() => {
    connectSocket();
    if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission();
    // Get agent name from cookie/session
    fetch(`${apiUrl}/api/users/me`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d.success && d.data?.name) setAgentName(d.data.name); })
      .catch(() => {});
    return () => { socketRef.current?.disconnect(); };
  }, [connectSocket, apiUrl]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typing]);

  function toggleOnline() {
    if (isOnline) {
      socketRef.current?.emit("support:go-offline");
      setIsOnline(false);
    } else {
      socketRef.current?.emit("support:go-online");
      socketRef.current?.emit("support:get-waiting");
      socketRef.current?.emit("support:get-my-chats");
      setIsOnline(true);
    }
  }

  function playNotification() {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 800; gain.gain.value = 0.3;
      osc.start(); osc.stop(ctx.currentTime + 1.5);
    } catch { /* ignore */ }
  }

  function showBrowserNotification(name: string, msg: string) {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("🔔 New Support Request", { body: `${name}: ${msg.slice(0, 80)}`, icon: "/funt-logo.png" });
    }
  }

  function acceptRequest(ticketId: string) { socketRef.current?.emit("support:accept", { ticketId }); }

  function selectChat(ticketId: string) {
    setSelectedChat(ticketId); setMessages([]);
    socketRef.current?.emit("chat:get-messages", { ticketId });
  }

  function sendMessage(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || !selectedChat) return;
    socketRef.current?.emit("chat:message", { ticketId: selectedChat, text: msg });
    if (!text) setInput("");
    setShowCanned(false);
  }

  function closeChat() {
    if (!selectedChat) return;
    socketRef.current?.emit("support:close", { ticketId: selectedChat });
  }

  function requestTransfer() {
    socketRef.current?.emit("support:get-online-agents");
    setShowTransfer(true);
  }

  function transferTo(agentId: string) {
    if (!selectedChat) return;
    socketRef.current?.emit("support:transfer", { ticketId: selectedChat, targetAgentId: agentId });
    setShowTransfer(false);
    setActiveChats((prev) => prev.filter((c) => c.ticketId !== selectedChat));
    setSelectedChat(null); setMessages([]);
  }

  function handleLogout() {
    fetch(`${apiUrl}/api/auth/logout`, { method: "POST", credentials: "include" }).finally(() => router.push("/login"));
  }

  const selectedChatData = activeChats.find((c) => c.ticketId === selectedChat);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-900">
      {/* Top Bar */}
      <header className="flex items-center justify-between border-b border-slate-700/50 bg-slate-800 px-6 py-3">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-black text-white">FUNT Support</h1>
          {agentName && <span className="text-sm text-slate-400">Hi, {agentName}</span>}
          <span className="rounded-full bg-slate-700 px-2.5 py-0.5 text-xs font-medium text-slate-300">
            {agentsCount} online
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={toggleOnline}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition ${
              isOnline ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}>
            <span className={`h-2 w-2 rounded-full ${isOnline ? "bg-white animate-pulse" : "bg-slate-500"}`} />
            {isOnline ? "Online" : "Go Online"}
          </button>
          <button onClick={handleLogout} className="rounded-lg px-3 py-2 text-xs text-slate-400 hover:text-white hover:bg-slate-700 transition">
            Sign Out
          </button>
        </div>
      </header>

      {!isOnline ? (
        <div className="flex flex-1 items-center justify-center text-center">
          <div>
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-800 border border-slate-700">
              <svg className="h-10 w-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="mt-4 text-base font-medium text-slate-400">You&apos;re offline</p>
            <p className="mt-1 text-sm text-slate-500">Click &quot;Go Online&quot; to start receiving support requests</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar */}
          <div className="flex w-80 shrink-0 flex-col border-r border-slate-700/50 bg-slate-800/50">
            {/* Incoming */}
            <div className="border-b border-slate-700/50 bg-amber-900/20 px-4 py-2.5">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Incoming · {incoming.length}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-700/30">
              {incoming.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-slate-500">Waiting for requests...</div>
              ) : incoming.map((req) => (
                <div key={req.ticketId} className="px-4 py-3 hover:bg-slate-700/30 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white truncate">{req.studentName}</p>
                      <p className="mt-0.5 text-xs text-slate-400 line-clamp-2">{req.message}</p>
                      <p className="mt-1 text-[10px] text-slate-500">{req.createdAt ? new Date(req.createdAt).toLocaleTimeString() : ""}</p>
                    </div>
                    <button onClick={() => acceptRequest(req.ticketId)}
                      className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition">
                      Accept
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Active Chats */}
            <div className="border-t border-slate-700/50 bg-indigo-900/20 px-4 py-2.5">
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                My Chats · {activeChats.length}
              </p>
            </div>
            <div className="overflow-y-auto divide-y divide-slate-700/30">
              {activeChats.map((chat) => (
                <button key={chat.ticketId} onClick={() => selectChat(chat.ticketId)}
                  className={`w-full px-4 py-3 text-left transition ${
                    selectedChat === chat.ticketId ? "bg-indigo-600/20 border-l-2 border-indigo-500" : "hover:bg-slate-700/30"
                  }`}>
                  <p className="text-sm font-medium text-white">{chat.studentName}</p>
                  <p className="text-[10px] font-mono text-slate-500">{chat.ticketNumber}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex flex-1 flex-col overflow-hidden bg-slate-900">
            {!selectedChat ? (
              <div className="flex flex-1 items-center justify-center text-center">
                <div>
                  <p className="text-sm text-slate-500">Select a chat or accept a new request</p>
                </div>
              </div>
            ) : (
              <>
                {/* Chat Header */}
                <div className="flex items-center justify-between border-b border-slate-700/50 bg-slate-800 px-5 py-3">
                  <div>
                    <p className="text-sm font-bold text-white">{selectedChatData?.studentName}</p>
                    <p className="text-[10px] font-mono text-slate-500">{selectedChatData?.ticketNumber} · @{selectedChatData?.studentUsername}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={requestTransfer}
                      className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition">
                      Transfer
                    </button>
                    <button onClick={closeChat}
                      className="rounded-lg bg-red-600/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 transition">
                      Close Chat
                    </button>
                  </div>
                </div>

                {/* Transfer Panel */}
                {showTransfer && (
                  <div className="border-b border-slate-700/50 bg-blue-900/20 px-5 py-3">
                    <p className="text-xs font-semibold text-blue-300 mb-2">Transfer to agent:</p>
                    {onlineAgents.length === 0 ? (
                      <p className="text-xs text-slate-500">No other agents online</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {onlineAgents.map((a) => (
                          <button key={a.id} onClick={() => transferTo(a.id)}
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-500">
                            {a.name}
                          </button>
                        ))}
                      </div>
                    )}
                    <button onClick={() => setShowTransfer(false)} className="mt-2 text-xs text-slate-500 hover:text-slate-300">Cancel</button>
                  </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                  {messages.map((m) => (
                    <div key={m.messageId} className={`flex ${m.senderRole === "STUDENT" ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${
                        m.senderRole === "STUDENT"
                          ? "bg-slate-700 text-slate-100 rounded-bl-md"
                          : "bg-indigo-600 text-white rounded-br-md"
                      }`}>{m.text}</div>
                    </div>
                  ))}
                  {typing && (
                    <div className="flex justify-start">
                      <div className="rounded-2xl bg-slate-700 px-4 py-2.5 text-sm text-slate-400 rounded-bl-md">typing...</div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Canned Responses */}
                {showCanned && (
                  <div className="border-t border-slate-700/50 bg-slate-800/80 px-5 py-3">
                    <div className="flex flex-wrap gap-2">
                      {CANNED_RESPONSES.map((r, i) => (
                        <button key={i} onClick={() => sendMessage(r)}
                          className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-indigo-600 hover:border-indigo-500 transition">
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Input */}
                <div className="border-t border-slate-700/50 bg-slate-800 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setShowCanned((v) => !v)} title="Quick replies"
                      className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                        showCanned ? "bg-indigo-600 text-white" : "bg-slate-700 text-slate-400 hover:text-white"
                      }`}>
                      ⚡
                    </button>
                    <input type="text" value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                      placeholder="Type your reply..."
                      className="flex-1 rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                    <button onClick={() => sendMessage()} disabled={!input.trim()}
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 transition">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

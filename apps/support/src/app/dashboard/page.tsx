"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useRouter } from "next/navigation";
import {
  Headphones, Wifi, WifiOff, LogOut, Zap, Users, MessageCircle,
  Clock, Send, ArrowRightLeft, X, ChevronRight, Bell, Inbox,
} from "lucide-react";

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

interface OnlineAgent {
  id: string;
  name: string;
}

const CANNED_RESPONSES = [
  "Let me check that for you.",
  "Can you share your username?",
  "I've fixed the issue, please try again now.",
  "Could you provide more details about the problem?",
  "Please refresh your page and try again.",
  "I'm escalating this to the team.",
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
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedChatRef = useRef<string | null>(null);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:38472";

  const connectSocket = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socket = io(apiUrl, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      withCredentials: true,
    });

    socket.on("connect", () => {});
    socket.on("connect_error", () => router.push("/login"));
    socket.on("disconnect", () => setIsOnline(false));

    socket.on("support:incoming", (data: IncomingRequest) => {
      setIncoming((prev) => [data, ...prev]);
      playNotification();
      showBrowserNotification(data.studentName, data.message);
    });
    socket.on("support:claimed", (data: { ticketId: string }) =>
      setIncoming((prev) => prev.filter((r) => r.ticketId !== data.ticketId))
    );
    socket.on("support:waiting-list", (data: { requests: IncomingRequest[] }) =>
      setIncoming(data.requests)
    );
    socket.on("support:my-chats", (data: { chats: ActiveChat[] }) =>
      setActiveChats(data.chats)
    );
    socket.on("support:agents-count", (data: { count: number }) =>
      setAgentsCount(data.count)
    );
    socket.on("support:online-agents", (data: { agents: OnlineAgent[] }) =>
      setOnlineAgents(data.agents)
    );
    socket.on("support:accepted", (data: { ticketId: string; studentName: string; ticketNumber: string; studentUsername: string }) => {
      setActiveChats((prev) => [
        ...prev,
        { ticketId: data.ticketId, ticketNumber: data.ticketNumber, studentName: data.studentName, studentUsername: data.studentUsername ?? "", subject: "" },
      ]);
      setSelectedChat(data.ticketId);
      socket.emit("chat:get-messages", { ticketId: data.ticketId });
    });
    socket.on("support:assigned-to-you", (data: { ticketId: string; ticketNumber: string; studentName: string; transferredFrom: string }) => {
      setActiveChats((prev) => [
        ...prev,
        { ticketId: data.ticketId, ticketNumber: data.ticketNumber, studentName: data.studentName, studentUsername: "", subject: `Transferred from ${data.transferredFrom}` },
      ]);
      playNotification();
    });
    socket.on("chat:messages", (data: { ticketId: string; messages: ChatMessage[] }) => {
      if (data.ticketId === selectedChatRef.current) setMessages(data.messages);
    });
    socket.on("chat:message", (data: ChatMessage) => {
      if (data.ticketId === selectedChatRef.current) {
        setMessages((prev) => [...prev, data]);
        setTyping(false);
      }
    });
    socket.on("chat:typing", () => setTyping(true));
    socket.on("chat:stopped-typing", () => setTyping(false));
    socket.on("support:closed", (data: { ticketId: string }) => {
      setActiveChats((prev) => prev.filter((c) => c.ticketId !== data.ticketId));
      if (selectedChatRef.current === data.ticketId) {
        setSelectedChat(null);
        setMessages([]);
      }
    });
    socket.on("support:rated", () => {});

    socketRef.current = socket;
  }, [apiUrl, router]);

  useEffect(() => {
    connectSocket();
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
    fetch(`${apiUrl}/api/users/me`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d.success && d.data?.name) setAgentName(d.data.name); })
      .catch(() => {});
    return () => { socketRef.current?.disconnect(); };
  }, [connectSocket, apiUrl]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

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
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {}
  }

  function showBrowserNotification(name: string, msg: string) {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("New Support Request", { body: `${name}: ${msg.slice(0, 80)}`, icon: "/favicon.ico" });
    }
  }

  function acceptRequest(ticketId: string) {
    socketRef.current?.emit("support:accept", { ticketId });
  }

  function selectChat(ticketId: string) {
    setSelectedChat(ticketId);
    setMessages([]);
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
    setShowCloseConfirm(false);
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
    setSelectedChat(null);
    setMessages([]);
  }

  function handleLogout() {
    fetch(`${apiUrl}/api/auth/logout`, { method: "POST", credentials: "include" })
      .finally(() => router.push("/login"));
  }

  const selectedChatData = activeChats.find((c) => c.ticketId === selectedChat);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50">
      {/* Top Bar */}
      <header className="glass-nav sticky top-0 z-30 flex h-14 items-center justify-between px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Headphones className="h-4 w-4" />
          </div>
          <h1 className="text-sm font-bold tracking-tight text-slate-900">FUNT Support</h1>
          {agentName && (
            <span className="hidden text-xs text-slate-500 sm:inline">
              — {agentName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isOnline && (
            <div className="mr-2 flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {agentsCount} online
              </span>
              <span className="flex items-center gap-1.5">
                <MessageCircle className="h-3.5 w-3.5" />
                {activeChats.length} chats
              </span>
              {incoming.length > 0 && (
                <span className="flex items-center gap-1.5 font-semibold text-amber-600">
                  <Bell className="h-3.5 w-3.5" />
                  {incoming.length} waiting
                </span>
              )}
            </div>
          )}
          <button
            onClick={toggleOnline}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold shadow-sm transition ${
              isOnline
                ? "bg-emerald-600 text-white shadow-emerald-900/15 hover:bg-emerald-500"
                : "btn-secondary"
            }`}
          >
            {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {isOnline ? "Online" : "Go Online"}
          </button>
          <button onClick={handleLogout} className="btn-secondary px-3 py-2 text-xs" title="Sign Out">
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* Offline State */}
      {!isOnline ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <Headphones className="h-10 w-10" />
            </div>
            <h2 className="mt-5 text-lg font-bold text-slate-800">You&apos;re offline</h2>
            <p className="mt-1.5 max-w-xs text-sm text-slate-500">
              Click &quot;Go Online&quot; to start receiving live support requests from students.
            </p>
            <button onClick={toggleOnline} className="btn-primary mt-6 inline-flex items-center gap-2 text-sm">
              <Wifi className="h-4 w-4" /> Go Online
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar — Queue & Active Chats */}
          <aside className="flex w-80 shrink-0 flex-col border-r border-slate-200/90 bg-white">
            {/* Incoming Queue */}
            <div className="border-b border-slate-100 px-4 py-2.5">
              <div className="flex items-center justify-between">
                <span className="label-overline text-amber-700">
                  Incoming
                </span>
                {incoming.length > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                    {incoming.length}
                  </span>
                )}
              </div>
            </div>

            <div className="max-h-[40%] overflow-y-auto divide-y divide-slate-50">
              {incoming.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <Inbox className="h-6 w-6 text-slate-300" />
                  <p className="mt-2 text-xs text-slate-400">No pending requests</p>
                </div>
              ) : (
                incoming.map((req) => (
                  <div key={req.ticketId} className="group px-4 py-3 transition hover:bg-amber-50/50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {req.studentName}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">
                          {req.message}
                        </p>
                        <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                          <Clock className="h-2.5 w-2.5" />
                          {req.createdAt ? timeAgo(req.createdAt) : ""}
                        </p>
                      </div>
                      <button
                        onClick={() => acceptRequest(req.ticketId)}
                        className="shrink-0 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-sm transition hover:bg-emerald-500"
                      >
                        Accept
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Active Chats */}
            <div className="border-y border-slate-100 px-4 py-2.5">
              <div className="flex items-center justify-between">
                <span className="label-overline text-indigo-700">My Chats</span>
                <span className="text-[10px] font-semibold text-slate-400">
                  {activeChats.length}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {activeChats.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <MessageCircle className="h-6 w-6 text-slate-300" />
                  <p className="mt-2 text-xs text-slate-400">No active chats</p>
                </div>
              ) : (
                activeChats.map((chat) => (
                  <button
                    key={chat.ticketId}
                    onClick={() => selectChat(chat.ticketId)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                      selectedChat === chat.ticketId
                        ? "border-l-[3px] border-l-indigo-600 bg-indigo-50/60"
                        : "border-l-[3px] border-l-transparent hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                      {chat.studentName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {chat.studentName}
                      </p>
                      <p className="truncate text-[10px] font-mono text-slate-400">
                        {chat.ticketNumber}
                      </p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                  </button>
                ))
              )}
            </div>
          </aside>

          {/* Chat Area */}
          <main className="flex flex-1 flex-col overflow-hidden">
            {!selectedChat ? (
              <div className="flex flex-1 items-center justify-center text-center">
                <div>
                  <MessageCircle className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-3 text-sm font-medium text-slate-600">
                    Select a chat or accept a request
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Conversations will appear here
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Chat Header */}
                <div className="flex items-center justify-between border-b border-slate-200/90 bg-white px-5 py-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                      {selectedChatData?.studentName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        {selectedChatData?.studentName}
                      </p>
                      <p className="text-[10px] font-mono text-slate-400">
                        {selectedChatData?.ticketNumber}
                        {selectedChatData?.studentUsername && ` · @${selectedChatData.studentUsername}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={requestTransfer}
                      className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" /> Transfer
                    </button>
                    <button
                      onClick={() => setShowCloseConfirm(true)}
                      className="btn-danger inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
                    >
                      <X className="h-3.5 w-3.5" /> Close
                    </button>
                  </div>
                </div>

                {/* Transfer Panel */}
                {showTransfer && (
                  <div className="border-b border-slate-200 bg-blue-50/80 px-5 py-3">
                    <p className="mb-2 text-xs font-semibold text-blue-700">
                      Transfer to another agent:
                    </p>
                    {onlineAgents.length === 0 ? (
                      <p className="text-xs text-slate-500">No other agents are online right now.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {onlineAgents.map((a) => (
                          <button
                            key={a.id}
                            onClick={() => transferTo(a.id)}
                            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                          >
                            {a.name}
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => setShowTransfer(false)}
                      className="mt-2 text-xs text-slate-400 hover:text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 to-white p-5 space-y-3">
                  {messages.length === 0 && !typing && (
                    <div className="flex items-center justify-center py-10 text-xs text-slate-400">
                      No messages yet — start typing to help the student.
                    </div>
                  )}
                  {messages.map((m) => (
                    <div
                      key={m.messageId}
                      className={`flex ${m.senderRole === "STUDENT" ? "justify-start" : "justify-end"}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                          m.senderRole === "STUDENT"
                            ? "rounded-bl-md border border-slate-200 bg-white text-slate-800"
                            : "rounded-br-md bg-indigo-600 text-white shadow-indigo-900/15"
                        }`}
                      >
                        {m.text}
                        <span className={`mt-1 block text-[10px] ${m.senderRole === "STUDENT" ? "text-slate-400" : "text-indigo-200"}`}>
                          {m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                  {typing && (
                    <div className="flex justify-start">
                      <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-400 shadow-sm">
                        <span className="inline-flex gap-1">
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0ms" }} />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "150ms" }} />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "300ms" }} />
                        </span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Canned Responses */}
                {showCanned && (
                  <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Quick Replies
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {CANNED_RESPONSES.map((r, i) => (
                        <button
                          key={i}
                          onClick={() => sendMessage(r)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Input */}
                <div className="border-t border-slate-200 bg-white px-5 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowCanned((v) => !v)}
                      title="Quick replies"
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition ${
                        showCanned
                          ? "border-indigo-200 bg-indigo-50 text-indigo-600"
                          : "border-slate-200 text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      <Zap className="h-4 w-4" />
                    </button>
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                      placeholder="Type your reply..."
                      className="input flex-1 !py-2 text-sm"
                    />
                    <button
                      onClick={() => sendMessage()}
                      disabled={!input.trim()}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-40"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </main>
        </div>
      )}

      {/* Close Chat Confirmation Modal */}
      {showCloseConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowCloseConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <X className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Close Chat</h3>
                <p className="text-xs text-slate-500">
                  {selectedChatData?.studentName} — {selectedChatData?.ticketNumber}
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-600">
              Are you sure you want to close this conversation? The student will be notified that the chat has ended.
            </p>
            <div className="mt-5 flex gap-2 justify-end">
              <button
                onClick={() => setShowCloseConfirm(false)}
                className="btn-secondary px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={closeChat}
                className="btn-danger px-4 py-2 text-sm"
              >
                Close Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

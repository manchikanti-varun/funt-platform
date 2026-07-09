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
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedChatRef = useRef<string | null>(null);

  useEffect(() => { selectedChatRef.current = selectedChat; }, [selectedChat]);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:38472";

  const connectSocket = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socket = io(apiUrl, { path: "/socket.io", transports: ["websocket", "polling"], withCredentials: true });
    socket.on("connect", () => {});
    socket.on("connect_error", () => router.push("/login"));
    socket.on("disconnect", () => setIsOnline(false));
    socket.on("support:incoming", (data: IncomingRequest) => { setIncoming((prev) => [data, ...prev]); playNotification(); showBrowserNotification(data.studentName, data.message); });
    socket.on("support:claimed", (data: { ticketId: string }) => setIncoming((prev) => prev.filter((r) => r.ticketId !== data.ticketId)));
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
    socket.on("chat:messages", (data: { ticketId: string; messages: ChatMessage[] }) => { if (data.ticketId === selectedChatRef.current) setMessages(data.messages); });
    socket.on("chat:message", (data: ChatMessage) => { if (data.ticketId === selectedChatRef.current) { setMessages((prev) => [...prev, data]); setTyping(false); } });
    socket.on("chat:typing", () => setTyping(true));
    socket.on("chat:stopped-typing", () => setTyping(false));
    socket.on("support:closed", (data: { ticketId: string }) => { setActiveChats((prev) => prev.filter((c) => c.ticketId !== data.ticketId)); if (selectedChatRef.current === data.ticketId) { setSelectedChat(null); setMessages([]); } });
    socket.on("support:rated", () => {});
    socketRef.current = socket;
  }, [apiUrl, router]);

  useEffect(() => {
    connectSocket();
    if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission();
    fetch(`${apiUrl}/api/users/me`, { credentials: "include" }).then((r) => r.json()).then((d) => { if (d.success && d.data?.name) setAgentName(d.data.name); }).catch(() => {});
    return () => { socketRef.current?.disconnect(); };
  }, [connectSocket, apiUrl]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typing]);

  function toggleOnline() {
    if (isOnline) { socketRef.current?.emit("support:go-offline"); setIsOnline(false); }
    else { socketRef.current?.emit("support:go-online"); socketRef.current?.emit("support:get-waiting"); socketRef.current?.emit("support:get-my-chats"); setIsOnline(true); }
  }
  function playNotification() { try { const ctx = new AudioContext(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.connect(gain); gain.connect(ctx.destination); osc.frequency.value = 800; gain.gain.value = 0.3; osc.start(); osc.stop(ctx.currentTime + 1.5); } catch {} }
  function showBrowserNotification(n: string, msg: string) { if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification("🔔 New Support Request", { body: `${n}: ${msg.slice(0, 80)}` }); }
  function acceptRequest(ticketId: string) { socketRef.current?.emit("support:accept", { ticketId }); }
  function selectChat(ticketId: string) { setSelectedChat(ticketId); setMessages([]); socketRef.current?.emit("chat:get-messages", { ticketId }); }
  function sendMessage(text?: string) { const msg = (text ?? input).trim(); if (!msg || !selectedChat) return; socketRef.current?.emit("chat:message", { ticketId: selectedChat, text: msg }); if (!text) setInput(""); setShowCanned(false); }
  function closeChat() { if (!selectedChat) return; socketRef.current?.emit("support:close", { ticketId: selectedChat }); }
  function requestTransfer() { socketRef.current?.emit("support:get-online-agents"); setShowTransfer(true); }
  function transferTo(agentId: string) { if (!selectedChat) return; socketRef.current?.emit("support:transfer", { ticketId: selectedChat, targetAgentId: agentId }); setShowTransfer(false); setActiveChats((prev) => prev.filter((c) => c.ticketId !== selectedChat)); setSelectedChat(null); setMessages([]); }
  function handleLogout() { fetch(`${apiUrl}/api/auth/logout`, { method: "POST", credentials: "include" }).finally(() => router.push("/login")); }
  const selectedChatData = activeChats.find((c) => c.ticketId === selectedChat);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Top Bar — same style as admin */}
      <header className="glass-nav sticky top-0 z-30 flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-black tracking-tight text-slate-900">FUNT Support</h1>
          {agentName && <span className="text-sm text-slate-500">Hi, {agentName}</span>}
          <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">{agentsCount} online</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={toggleOnline}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm transition ${
              isOnline ? "bg-emerald-600 text-white shadow-emerald-900/15 hover:bg-emerald-500" : "btn-secondary"
            }`}>
            <span className={`h-2.5 w-2.5 rounded-full ${isOnline ? "bg-white animate-pulse" : "bg-slate-400"}`} />
            {isOnline ? "Online" : "Go Online"}
          </button>
          <button onClick={handleLogout} className="btn-secondary px-3 py-2 text-xs">Sign Out</button>
        </div>
      </header>

      {!isOnline ? (
        <div className="flex flex-1 items-center justify-center text-center">
          <div>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="mt-4 text-sm font-medium text-slate-700">You&apos;re currently offline</p>
            <p className="mt-1 text-xs text-slate-500">Click &quot;Go Online&quot; to start receiving support requests</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar */}
          <div className="flex w-80 shrink-0 flex-col border-r border-slate-200/90 bg-white">
            <div className="border-b border-slate-100 bg-amber-50 px-4 py-3">
              <p className="label-overline text-amber-700">Incoming · {incoming.length}</p>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {incoming.length === 0 ? (
                <div className="px-4 py-10 text-center text-xs text-slate-400">Waiting for requests...</div>
              ) : incoming.map((req) => (
                <div key={req.ticketId} className="px-4 py-3 hover:bg-slate-50 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 truncate">{req.studentName}</p>
                      <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{req.message}</p>
                      <p className="mt-1 text-[10px] text-slate-400">{req.createdAt ? new Date(req.createdAt).toLocaleTimeString() : ""}</p>
                    </div>
                    <button onClick={() => acceptRequest(req.ticketId)} className="shrink-0 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 shadow-sm">Accept</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-200 bg-indigo-50/50 px-4 py-3">
              <p className="label-overline text-indigo-700">My Chats · {activeChats.length}</p>
            </div>
            <div className="overflow-y-auto divide-y divide-slate-100">
              {activeChats.map((chat) => (
                <button key={chat.ticketId} onClick={() => selectChat(chat.ticketId)}
                  className={`w-full px-4 py-3 text-left transition ${selectedChat === chat.ticketId ? "bg-indigo-50 border-l-4 border-indigo-600" : "hover:bg-slate-50"}`}>
                  <p className="text-sm font-medium text-slate-800">{chat.studentName}</p>
                  <p className="text-[10px] font-mono text-slate-400">{chat.ticketNumber}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex flex-1 flex-col overflow-hidden bg-slate-50/50">
            {!selectedChat ? (
              <div className="flex flex-1 items-center justify-center text-center">
                <p className="text-sm text-slate-500">Select a chat or accept a new request</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-slate-200/90 bg-white px-5 py-3 shadow-sm">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{selectedChatData?.studentName}</p>
                    <p className="text-[10px] font-mono text-slate-400">{selectedChatData?.ticketNumber} · @{selectedChatData?.studentUsername}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={requestTransfer} className="btn-secondary px-3 py-1.5 text-xs">Transfer</button>
                    <button onClick={closeChat} className="btn-danger px-3 py-1.5 text-xs">Close Chat</button>
                  </div>
                </div>

                {showTransfer && (
                  <div className="border-b border-slate-200 bg-blue-50 px-5 py-3">
                    <p className="text-xs font-semibold text-blue-700 mb-2">Transfer to:</p>
                    {onlineAgents.length === 0 ? <p className="text-xs text-slate-500">No other agents online</p> : (
                      <div className="flex flex-wrap gap-2">
                        {onlineAgents.map((a) => (
                          <button key={a.id} onClick={() => transferTo(a.id)} className="btn-primary px-3 py-1.5 text-xs">{a.name}</button>
                        ))}
                      </div>
                    )}
                    <button onClick={() => setShowTransfer(false)} className="mt-2 text-xs text-slate-400 hover:text-slate-600">Cancel</button>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                  {messages.map((m) => (
                    <div key={m.messageId} className={`flex ${m.senderRole === "STUDENT" ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                        m.senderRole === "STUDENT"
                          ? "bg-white border border-slate-200 text-slate-800 rounded-bl-md"
                          : "bg-indigo-600 text-white rounded-br-md shadow-indigo-900/15"
                      }`}>{m.text}</div>
                    </div>
                  ))}
                  {typing && <div className="flex justify-start"><div className="rounded-2xl bg-white border border-slate-200 px-4 py-2.5 text-sm text-slate-400 rounded-bl-md shadow-sm">typing...</div></div>}
                  <div ref={messagesEndRef} />
                </div>

                {showCanned && (
                  <div className="border-t border-slate-200 bg-white px-5 py-3">
                    <div className="flex flex-wrap gap-2">
                      {CANNED_RESPONSES.map((r, i) => (
                        <button key={i} onClick={() => sendMessage(r)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 hover:border-indigo-200 transition">{r}</button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t border-slate-200 bg-white px-5 py-4">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setShowCanned((v) => !v)} title="Quick replies"
                      className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${showCanned ? "bg-indigo-50 border-indigo-200 text-indigo-600" : "border-slate-200 text-slate-400 hover:text-slate-600"}`}>
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </button>
                    <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                      placeholder="Type your reply..." className="input flex-1" />
                    <button onClick={() => sendMessage()} disabled={!input.trim()} className="btn-primary flex h-10 w-10 items-center justify-center !p-0 !rounded-xl disabled:opacity-40">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
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

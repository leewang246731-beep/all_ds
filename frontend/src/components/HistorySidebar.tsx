import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  MessageSquare,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface HistoryItem {
  thread_id: string;
  title: string;
  created_at: string | null;
}

interface HistorySidebarProps {
  onNewChat: () => void;
  onSelectThread: (threadId: string) => void;
  currentThreadId: string | null;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function HistorySidebar({
  onNewChat,
  onSelectThread,
  currentThreadId,
  isCollapsed,
  onToggleCollapse,
}: HistorySidebarProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/history", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDelete = async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("确定要删除这个对话吗？")) return;

    setDeletingId(threadId);
    try {
      const res = await fetch(`/api/history/${threadId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setHistory(history.filter((h) => h.thread_id !== threadId));
      }
    } catch (err) {
      console.error("Failed to delete history:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "刚刚";
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString("zh-CN");
  };

  if (isCollapsed) {
    return (
      <div className="w-12 h-full bg-neutral-900/80 border-r border-neutral-800 flex flex-col items-center py-3 gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="text-neutral-400 hover:text-[var(--color-brand)] hover:bg-[var(--color-brand-bg)] w-8 h-8"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onNewChat}
          className="text-neutral-400 hover:text-[var(--color-brand)] hover:bg-[var(--color-brand-bg)] w-8 h-8"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <div className="flex-1" />
      </div>
    );
  }

  return (
    <div className="w-64 h-full bg-neutral-900/80 border-r border-neutral-800 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-neutral-800">
        <span className="text-sm font-medium text-neutral-300">对话历史</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="text-neutral-400 hover:text-neutral-200 w-6 h-6"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* New Chat Button */}
      <div className="p-2">
        <Button
          variant="ghost"
          onClick={onNewChat}
          className="w-full justify-start gap-2 text-neutral-300 hover:text-[var(--color-brand)] hover:bg-[var(--color-brand-bg)] border border-neutral-700/50 rounded-lg"
        >
          <Plus className="h-4 w-4" />
          <span className="text-sm">新对话</span>
        </Button>
      </div>

      {/* History List */}
      <ScrollArea className="flex-1 px-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-neutral-500" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-neutral-500 text-sm">
            暂无历史记录
          </div>
        ) : (
          <div className="space-y-1">
            {history.map((item) => (
              <div
                key={item.thread_id}
                onClick={() => onSelectThread(item.thread_id)}
                className={`group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-all duration-150 ${
                  currentThreadId === item.thread_id
                    ? "bg-[var(--color-brand)]/10 border border-[var(--color-brand)]/20"
                    : "hover:bg-neutral-800/50 border border-transparent"
                }`}
              >
                <MessageSquare className={`h-4 w-4 flex-shrink-0 ${
                  currentThreadId === item.thread_id
                    ? "text-[var(--color-brand)]"
                    : "text-neutral-500"
                }`} />
                <div className="flex-1 min-w-0">
                  <div className={`text-sm truncate ${
                    currentThreadId === item.thread_id
                      ? "text-[var(--color-brand)]"
                      : "text-neutral-300"
                  }`}>
                    {item.title}
                  </div>
                  <div className="text-[10px] text-neutral-600">
                    {formatDate(item.created_at)}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => handleDelete(item.thread_id, e)}
                  disabled={deletingId === item.thread_id}
                  className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-red-400 w-5 h-5 transition-opacity"
                >
                  {deletingId === item.thread_id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

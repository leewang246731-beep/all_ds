import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  Trash2,
  Search,
  RefreshCw,
  ArrowLeft,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";

interface KnowledgeFile {
  id: number;
  title: string;
  file_type: string;
  process_status: string;
  chunk_count: number;
  created_at: string;
}

interface KnowledgeBaseProps {
  onBack: () => void;
}

const FILE_TYPE_ICONS: Record<string, string> = {
  ".pdf": "📄",
  ".docx": "📝",
  ".doc": "📝",
  ".xlsx": "📊",
  ".xls": "📊",
  ".pptx": "📽️",
  ".ppt": "📽️",
  ".md": "📋",
  ".txt": "📋",
  ".csv": "📊",
};

const STATUS_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  done: { icon: CheckCircle, color: "text-green-400", label: "已完成" },
  failed: { icon: XCircle, color: "text-red-400", label: "失败" },
  parsing: { icon: Loader2, color: "text-blue-400", label: "解析中" },
  vectorizing: { icon: Loader2, color: "text-yellow-400", label: "向量化中" },
  pending: { icon: Clock, color: "text-neutral-400", label: "等待中" },
};

export function KnowledgeBase({ onBack }: KnowledgeBaseProps) {
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/upload/list", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
      }
    } catch (err) {
      console.error("Failed to fetch files:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleDelete = async (fileId: number) => {
    if (!confirm("确定要删除这个文件吗？")) return;
    setDeletingId(fileId);
    try {
      const res = await fetch(`/api/upload/${fileId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setFiles(files.filter((f) => f.id !== fileId));
      }
    } catch (err) {
      console.error("Failed to delete file:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredFiles = files.filter(
    (f) =>
      f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.file_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalChunks = files.reduce((sum, f) => sum + f.chunk_count, 0);

  return (
    <div className="flex flex-col h-full bg-neutral-800">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-700">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="text-neutral-400 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold text-neutral-100">企业知识库</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchFiles}
            className="text-neutral-400 hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search and Stats */}
      <div className="p-4 border-b border-neutral-700">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
            <input
              type="text"
              placeholder="搜索文件..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-700 text-neutral-100 placeholder-neutral-500 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="text-sm text-neutral-400">
          共 {files.length} 项知识 | 总 chunks: {totalChunks}
        </div>
      </div>

      {/* File List */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-neutral-500">
              <FileText className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-lg mb-1">暂无知识</p>
              <p className="text-sm">上传文件或完成研究后，知识会自动积累到这里</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFiles.map((file) => {
                const StatusConfig = STATUS_CONFIG[file.process_status] || STATUS_CONFIG.pending;
                const StatusIcon = StatusConfig.icon;
                const icon = FILE_TYPE_ICONS[file.file_type] || "📄";

                return (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 bg-neutral-700 rounded-lg hover:bg-neutral-600 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-xl">{icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-neutral-100 truncate">
                          {file.title}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-neutral-400">
                          <span className={`flex items-center gap-1 ${StatusConfig.color}`}>
                            <StatusIcon
                              className={`h-3 w-3 ${
                                file.process_status === "parsing" ||
                                file.process_status === "vectorizing"
                                  ? "animate-spin"
                                  : ""
                              }`}
                            />
                            {StatusConfig.label}
                          </span>
                          {file.process_status === "done" && (
                            <span>{file.chunk_count} chunks</span>
                          )}
                          <span>
                            {new Date(file.created_at).toLocaleDateString("zh-CN")}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(file.id)}
                      disabled={deletingId === file.id}
                      className="text-neutral-400 hover:text-red-400 ml-2"
                    >
                      {deletingId === file.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

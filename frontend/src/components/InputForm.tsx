import { useState, useEffect, forwardRef, useImperativeHandle, useRef } from "react";
import { Button } from "@/components/ui/button";
import { SquarePen, Brain, Send, StopCircle, Zap, Cpu, Paperclip, X, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchAvailableModels, type ModelConfig } from "@/lib/api";

interface UploadedFile {
  id: number;
  title: string;
  file_type: string;
  process_status: string;
  chunk_count: number;
}

interface InputFormProps {
  onSubmit: (inputValue: string, effort: string, model: string, files: UploadedFile[]) => void;
  onCancel: () => void;
  isLoading: boolean;
  hasHistory: boolean;
}

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".doc", ".xlsx", ".xls", ".pptx", ".ppt", ".md", ".txt", ".csv"];
const MAX_FILE_SIZE = 50 * 1024 * 1024;

const FILE_TYPE_COLORS: Record<string, string> = {
  ".pdf": "text-red-400 bg-red-500/10",
  ".docx": "text-blue-400 bg-blue-500/10",
  ".doc": "text-blue-400 bg-blue-500/10",
  ".xlsx": "text-green-400 bg-green-500/10",
  ".xls": "text-green-400 bg-green-500/10",
  ".pptx": "text-orange-400 bg-orange-500/10",
  ".ppt": "text-orange-400 bg-orange-500/10",
  ".md": "text-purple-400 bg-purple-500/10",
  ".txt": "text-neutral-400 bg-neutral-500/10",
  ".csv": "text-cyan-400 bg-cyan-500/10",
};

export const InputForm = forwardRef<any, InputFormProps>(({
  onSubmit,
  onCancel,
  isLoading,
  hasHistory,
}, ref) => {
  const [internalInputValue, setInternalInputValue] = useState("");
  const [effort, setEffort] = useState("low");
  const [model, setModel] = useState("qwen-turbo-latest");
  const [availableModels, setAvailableModels] = useState<ModelConfig[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchAvailableModels().then((models) => {
      setAvailableModels(models);
      if (models.length > 0 && model === "qwen-turbo-latest") {
        setModel(models[0].model_id);
      }
    });
  }, []);

  useImperativeHandle(ref, () => ({
    setInputValue(value: string) {
      setInternalInputValue(value);
    },
    submitInput(value: string) {
      if (value.trim()) {
        onSubmit(value, effort, model, uploadedFiles);
        setInternalInputValue("");
      }
    },
  }), [effort, model, onSubmit, uploadedFiles]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadError(null);
    const file = files[0];

    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setUploadError(`不支持的文件格式: ${ext}`);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setUploadError("文件大小超过 50MB 限制");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "上传失败");
      }

      const result = await response.json();
      setUploadedFiles([...uploadedFiles, {
        id: result.id,
        title: result.title,
        file_type: result.file_type,
        process_status: result.process_status,
        chunk_count: result.chunk_count,
      }]);
    } catch (err: any) {
      setUploadError(err.message || "上传失败");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeFile = (fileId: number) => {
    setUploadedFiles(uploadedFiles.filter(f => f.id !== fileId));
  };

  const handleInternalSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!internalInputValue.trim()) return;
    onSubmit(internalInputValue, effort, model, uploadedFiles);
    setInternalInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleInternalSubmit();
    }
  };

  const isSubmitDisabled = !internalInputValue.trim() || isLoading;

  return (
    <form
      onSubmit={handleInternalSubmit}
      className="flex flex-col gap-3"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_EXTENSIONS.join(",")}
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* 已上传文件预览 */}
      {uploadedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1">
          {uploadedFiles.map((file) => {
            const colorClass = FILE_TYPE_COLORS[file.file_type] || "text-neutral-400 bg-neutral-500/10";
            return (
              <div
                key={file.id}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-neutral-700 ${colorClass}`}
              >
                <Paperclip className="h-3 w-3" />
                <span className="max-w-[120px] truncate font-medium">{file.title}</span>
                {file.process_status === "done" && (
                  <span className="text-green-400 text-[10px]">{file.chunk_count}块</span>
                )}
                {file.process_status === "parsing" && (
                  <Loader2 className="h-3 w-3 animate-spin" />
                )}
                <button
                  type="button"
                  onClick={() => removeFile(file.id)}
                  className="ml-1 text-neutral-500 hover:text-red-400 transition-colors cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {uploadError && (
        <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
          {uploadError}
        </div>
      )}

      {/* 输入框区域 */}
      <div className="glass rounded-2xl p-1">
        <div className="flex items-end gap-2 bg-neutral-800/50 rounded-xl px-4 pt-3 pb-2 border border-neutral-700/50 focus-within:border-[var(--color-brand)]/50 focus-within:shadow-[0_0_15px_rgba(42,107,255,0.1)] transition-all duration-300">
          <Textarea
            value={internalInputValue}
            onChange={(e) => setInternalInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入研究课题，如：2025年中国新能源汽车出口市场分析..."
            className="flex-1 text-neutral-100 placeholder-neutral-500 resize-none border-0 focus:outline-none focus:ring-0 shadow-none bg-transparent md:text-base min-h-[48px] max-h-[200px]"
            rows={1}
          />
          <div className="flex items-center gap-1 pb-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-neutral-400 hover:text-[var(--color-brand)] hover:bg-[var(--color-brand-bg)] p-2 cursor-pointer rounded-xl transition-all duration-200"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="上传文件"
            >
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Paperclip className="h-5 w-5" />
              )}
            </Button>
            {isLoading ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-red-500 hover:text-red-400 hover:bg-red-500/10 p-2 cursor-pointer rounded-xl transition-all duration-200"
                onClick={onCancel}
              >
                <StopCircle className="h-5 w-5" />
              </Button>
            ) : (
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                className={`p-2 cursor-pointer rounded-xl transition-all duration-200 ${
                  isSubmitDisabled
                    ? "text-neutral-600"
                    : "text-[var(--color-brand)] hover:bg-[var(--color-brand-bg)] hover:shadow-[0_0_15px_rgba(42,107,255,0.15)]"
                }`}
                disabled={isSubmitDisabled}
              >
                <Send className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 选项区域 */}
      <div className="flex items-center justify-between px-1">
        <div className="flex flex-row gap-2">
          {/* 专家选择 */}
          <div className="flex items-center gap-2 bg-neutral-800/50 border border-neutral-700/50 rounded-lg px-3 py-1.5 hover:border-neutral-600 transition-colors">
            <Brain className="h-4 w-4 text-[var(--color-brand)]" />
            <Select value={effort} onValueChange={setEffort}>
              <SelectTrigger className="w-[80px] bg-transparent border-none cursor-pointer h-6 text-xs text-neutral-300">
                <SelectValue placeholder="深度" />
              </SelectTrigger>
              <SelectContent className="bg-neutral-800 border-neutral-700 text-neutral-300">
                <SelectItem value="low" className="hover:bg-neutral-700 cursor-pointer">快速</SelectItem>
                <SelectItem value="medium" className="hover:bg-neutral-700 cursor-pointer">均衡</SelectItem>
                <SelectItem value="high" className="hover:bg-neutral-700 cursor-pointer">全面</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 模型选择 */}
          <div className="flex items-center gap-2 bg-neutral-800/50 border border-neutral-700/50 rounded-lg px-3 py-1.5 hover:border-neutral-600 transition-colors">
            <Cpu className="h-4 w-4 text-[var(--color-brand)]" />
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="w-[120px] bg-transparent border-none cursor-pointer h-6 text-xs text-neutral-300">
                <SelectValue placeholder="模型" />
              </SelectTrigger>
              <SelectContent className="bg-neutral-800 border-neutral-700 text-neutral-300">
                {availableModels.map((modelConfig) => {
                  const IconComponent = modelConfig.icon === "Cpu" ? Cpu : Zap;
                  return (
                    <SelectItem
                      key={modelConfig.model_id}
                      value={modelConfig.model_id}
                      className="hover:bg-neutral-700 cursor-pointer"
                    >
                      <div className="flex items-center">
                        <IconComponent className={`h-3 w-3 mr-2 text-${modelConfig.icon_color}`} />
                        <span className="text-xs">{modelConfig.display_name}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        {hasHistory && (
          <Button
            variant="ghost"
            className="text-neutral-400 hover:text-[var(--color-brand)] hover:bg-[var(--color-brand-bg)] text-xs flex items-center gap-1.5 transition-all duration-200"
            onClick={() => window.open("/", "_blank")}
          >
            <SquarePen size={14} />
            新专题
          </Button>
        )}
      </div>
    </form>
  );
});

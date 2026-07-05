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
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

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

    // 检查文件扩展名
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setUploadError(`不支持的文件格式: ${ext}`);
      return;
    }

    // 检查文件大小
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
      className={`flex flex-col gap-2 p-3 pb-4`}
    >
      {/* 文件上传区域 */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_EXTENSIONS.join(",")}
        onChange={handleFileUpload}
        className="hidden"
      />

      {uploadedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 px-2">
          {uploadedFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-1.5 bg-neutral-600 text-neutral-200 text-xs px-2.5 py-1 rounded-lg"
            >
              <Paperclip className="h-3 w-3" />
              <span className="max-w-[150px] truncate">{file.title}</span>
              {file.process_status === "done" && (
                <span className="text-green-400">({file.chunk_count})</span>
              )}
              {file.process_status === "parsing" && (
                <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
              )}
              <button
                type="button"
                onClick={() => removeFile(file.id)}
                className="text-neutral-400 hover:text-red-400 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {uploadError && (
        <div className="text-red-400 text-xs px-2">{uploadError}</div>
      )}

      <div
        className={`flex flex-row items-center justify-between text-white rounded-3xl rounded-bl-sm ${
          hasHistory ? "rounded-br-sm" : ""
        } break-words min-h-7 bg-neutral-700 px-4 pt-3 `}
      >
        <Textarea
          value={internalInputValue}
          onChange={(e) => setInternalInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="如何评价DeepSeek成立Harness团队？"
          className={`w-full text-neutral-100 placeholder-neutral-500 resize-none border-0 focus:outline-none focus:ring-0 outline-none focus-visible:ring-0 shadow-none
                        md:text-base  min-h-[56px] max-h-[200px]`}
          rows={1}
        />
        <div className="-mt-3 flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-neutral-400 hover:text-blue-400 hover:bg-blue-500/10 p-2 cursor-pointer rounded-full transition-all duration-200"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
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
              className="text-red-500 hover:text-red-400 hover:bg-red-500/10 p-2 cursor-pointer rounded-full transition-all duration-200"
              onClick={onCancel}
            >
              <StopCircle className="h-5 w-5" />
            </Button>
          ) : (
            <Button
              type="submit"
              variant="ghost"
              className={`${
                isSubmitDisabled
                  ? "text-neutral-500"
                  : "text-blue-500 hover:text-blue-400 hover:bg-blue-500/10"
              } p-2 cursor-pointer rounded-full transition-all duration-200 text-base`}
              disabled={isSubmitDisabled}
            >
              探索
              <Send className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex flex-row gap-2">
          <div className="flex flex-row gap-2 bg-neutral-700 border-neutral-600 text-neutral-300 focus:ring-neutral-500 rounded-xl rounded-t-sm pl-2  max-w-[100%] sm:max-w-[90%]">
            <div className="flex flex-row items-center text-sm">
              <Brain className="h-4 w-4 mr-2" />
              专家选择
            </div>
            <Select value={effort} onValueChange={setEffort}>
              <SelectTrigger className="w-[120px] bg-transparent border-none cursor-pointer">
                <SelectValue placeholder="Effort" />
              </SelectTrigger>
              <SelectContent className="bg-neutral-700 border-neutral-600 text-neutral-300 cursor-pointer">
                <SelectItem
                  value="low"
                  className="hover:bg-neutral-600 focus:bg-neutral-600 cursor-pointer"
                >
                  低
                </SelectItem>
                <SelectItem
                  value="medium"
                  className="hover:bg-neutral-600 focus:bg-neutral-600 cursor-pointer"
                >
                  中
                </SelectItem>
                <SelectItem
                  value="high"
                  className="hover:bg-neutral-600 focus:bg-neutral-600 cursor-pointer"
                >
                  高
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-row gap-2 bg-neutral-700 border-neutral-600 text-neutral-300 focus:ring-neutral-500 rounded-xl rounded-t-sm pl-2  max-w-[100%] sm:max-w-[90%]">
            <div className="flex flex-row items-center text-sm ml-2">
              <Cpu className="h-4 w-4 mr-2" />
              模型选择
            </div>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="w-[150px] bg-transparent border-none cursor-pointer">
                <SelectValue placeholder="Model" />
              </SelectTrigger>
              <SelectContent className="bg-neutral-700 border-neutral-600 text-neutral-300 cursor-pointer">
                {availableModels.map((modelConfig) => {
                  const IconComponent = modelConfig.icon === "Cpu" ? Cpu : Zap;
                  return (
                    <SelectItem
                      key={modelConfig.model_id}
                      value={modelConfig.model_id}
                      className="hover:bg-neutral-600 focus:bg-neutral-600 cursor-pointer"
                    >
                      <div className="flex items-center">
                        <IconComponent className={`h-4 w-4 mr-2 text-${modelConfig.icon_color}`} />
                        {modelConfig.display_name}
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
            className="bg-neutral-700 border-neutral-600 text-neutral-300 cursor-pointer rounded-xl rounded-t-sm pl-2 "
            variant="default"
            onClick={() => window.open("/", "_blank")}
          >
            <SquarePen size={16} />
            探索新专题
          </Button>
        )}
      </div>
    </form>
  );
});

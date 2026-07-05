import { InputForm } from "./InputForm";
import { Button } from "@/components/ui/button";
import { Database } from "lucide-react";

interface WelcomeScreenProps {
  handleSubmit: (
    submittedInputValue: string,
    effort: string,
    model: string,
    files: Array<{id: number, title: string}>
  ) => void;
  onCancel: () => void;
  isLoading: boolean;
  onShowKnowledgeBase?: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  handleSubmit,
  onCancel,
  isLoading,
  onShowKnowledgeBase,
}) => (
  <div className="h-full flex flex-col items-center justify-center text-center px-4 flex-1 w-full max-w-3xl mx-auto gap-4">
    <div className="flex items-center justify-between w-full max-w-2xl">
      <div className="text-left">
        <h1 className="text-5xl md:text-6xl font-semibold text-neutral-100 mb-3">
          欢迎你！专业、广博、迅捷的行业专家！
        </h1>
        <p className="text-xl md:text-2xl text-neutral-400">
          请在下方写入你的要求，让我们为你提供专业的帮助
        </p>
      </div>
      {onShowKnowledgeBase && (
        <Button
          variant="ghost"
          onClick={onShowKnowledgeBase}
          className="text-neutral-400 hover:text-blue-400 flex items-center gap-2 ml-4"
        >
          <Database className="h-5 w-5" />
          <span className="hidden md:inline">知识库</span>
        </Button>
      )}
    </div>
    <div className="w-full mt-4">
      <InputForm
        onSubmit={handleSubmit}
        isLoading={isLoading}
        onCancel={onCancel}
        hasHistory={false}
      />
    </div>
    <p className="text-xs text-neutral-500">
      基于LLM的深度搜索 | 上传文件结合联网搜索生成专业报告
    </p>
  </div>
);

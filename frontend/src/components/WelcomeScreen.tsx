import { InputForm } from "./InputForm";
import { Button } from "@/components/ui/button";
import { Database, Sparkles } from "lucide-react";

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
  <div className="h-full flex flex-col items-center justify-center text-center px-4 flex-1 w-full max-w-3xl mx-auto gap-6">
    {/* 品牌标识 */}
    <div className="flex items-center gap-3 mb-2 animate-fadeIn">
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-brand-light)] flex items-center justify-center shadow-lg shadow-blue-500/20">
        <Sparkles className="h-6 w-6 text-white" />
      </div>
    </div>

    {/* 标题区域 */}
    <div className="animate-fadeInUp">
      <h1 className="text-4xl md:text-5xl font-bold mb-3">
        <span className="gradient-text">Deep Research</span>
      </h1>
      <p className="text-lg md:text-xl text-neutral-400 max-w-2xl">
        上传内部资料 + 联网深度搜索，为企业生成专业研究报告
      </p>
    </div>

    {/* 输入区域 */}
    <div className="w-full mt-4 animate-fadeInUp animation-delay-200">
      <InputForm
        onSubmit={handleSubmit}
        isLoading={isLoading}
        onCancel={onCancel}
        hasHistory={false}
      />
    </div>

    {/* 底部功能提示 */}
    <div className="flex flex-wrap items-center justify-center gap-4 mt-4 animate-fadeInUp animation-delay-400">
      {onShowKnowledgeBase && (
        <Button
          variant="ghost"
          onClick={onShowKnowledgeBase}
          className="text-neutral-400 hover:text-[var(--color-brand)] hover:bg-[var(--color-brand-bg)] flex items-center gap-2 transition-all duration-200"
        >
          <Database className="h-4 w-4" />
          <span>企业知识库</span>
        </Button>
      )}
    </div>

    {/* 底部标签 */}
    <p className="text-xs text-neutral-600 mt-2">
      基于 LangGraph 多智能体架构 | 支持 PDF/Word/Excel/PPT 文件上传
    </p>
  </div>
);

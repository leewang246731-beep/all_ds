import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  Activity,
  Info,
  Search,
  TextSearch,
  Brain,
  Pen,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useEffect, useState } from "react";

export interface ProcessedEvent {
  title: string;
  data: any;
}

interface ActivityTimelineProps {
  processedEvents: ProcessedEvent[];
  isLoading: boolean;
  title?: string;
}

export function ActivityTimeline({
  processedEvents,
  isLoading,
  title = "生成计划",
}: ActivityTimelineProps) {
  const [isTimelineCollapsed, setIsTimelineCollapsed] =
    useState<boolean>(false);
  const getEventIcon = (title: string, index: number) => {
    if (index === 0 && isLoading && processedEvents.length === 0) {
      return <Loader2 className="h-4 w-4 text-neutral-400 animate-spin" />;
    }
    if (title.toLowerCase().includes("generating")) {
      return <TextSearch className="h-4 w-4 text-neutral-400" />;
    } else if (title.toLowerCase().includes("thinking")) {
      return <Loader2 className="h-4 w-4 text-neutral-400 animate-spin" />;
    } else if (title.toLowerCase().includes("reflection")) {
      return <Brain className="h-4 w-4 text-neutral-400" />;
    } else if (title.toLowerCase().includes("research")) {
      return <Search className="h-4 w-4 text-neutral-400" />;
    } else if (title.toLowerCase().includes("finalizing")) {
      return <Pen className="h-4 w-4 text-neutral-400" />;
    }
    return <Activity className="h-4 w-4 text-neutral-400" />;
  };

  useEffect(() => {
    if (!isLoading && processedEvents.length !== 0) {
      setIsTimelineCollapsed(true);
    }
    if (
      processedEvents.some(
        (event) => event.title === "生成计划"
      )
    ) {
      setIsTimelineCollapsed(false);
    }
  }, [isLoading, processedEvents]);

  return (
    <Card className="glass border border-neutral-700/50 rounded-xl max-h-96 overflow-hidden">
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center justify-between">
          <div
            className="flex items-center justify-start text-sm w-full cursor-pointer gap-2 text-neutral-100 hover:text-[var(--color-brand)] transition-colors"
            onClick={() => setIsTimelineCollapsed(!isTimelineCollapsed)}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)] pulse-glow" />
            <span className="font-medium">{title}</span>
            {isTimelineCollapsed ? (
              <ChevronDown className="h-4 w-4 ml-auto text-neutral-500" />
            ) : (
              <ChevronUp className="h-4 w-4 ml-auto text-neutral-500" />
            )}
          </div>
        </CardDescription>
      </CardHeader>
      {!isTimelineCollapsed && (
        <ScrollArea className="max-h-80 overflow-y-auto">
          <CardContent className="pt-0">
            {isLoading && processedEvents.length === 0 && (
              <div className="relative pl-8 pb-4 fade-slide-in">
                <div className="absolute left-3 top-3.5 h-full w-0.5 bg-gradient-to-b from-[var(--color-brand)]/20 to-transparent" />
                <div className="absolute left-0.5 top-2 h-6 w-6 rounded-full bg-[var(--color-brand)]/20 flex items-center justify-center ring-4 ring-neutral-900 pulse-glow">
                  <Loader2 className="h-3 w-3 text-[var(--color-brand)] animate-spin" />
                </div>
                <div>
                  <p className="text-sm text-neutral-200 font-medium">
                    正在分析中...
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">请稍候</p>
                </div>
              </div>
            )}
            {processedEvents.length > 0 ? (
              <div className="space-y-0">
                {processedEvents.map((eventItem, index) => (
                  <div key={index} className="relative pl-8 pb-4 fade-slide-in" style={{ animationDelay: `${index * 0.1}s` }}>
                    {index < processedEvents.length - 1 ||
                    (isLoading && index === processedEvents.length - 1) ? (
                      <div className="absolute left-3 top-3.5 h-full w-0.5 bg-gradient-to-b from-[var(--color-brand)]/30 to-neutral-700/30" />
                    ) : null}
                    <div className={`absolute left-0.5 top-2 h-6 w-6 rounded-full flex items-center justify-center ring-4 ring-neutral-900 ${
                      index === processedEvents.length - 1 && isLoading
                        ? "bg-[var(--color-brand)]/20 pulse-glow"
                        : "bg-neutral-700"
                    }`}>
                      {getEventIcon(eventItem.title, index)}
                    </div>
                    <div>
                      <p className="text-sm text-neutral-100 font-medium mb-0.5">
                        {eventItem.title}
                      </p>
                      <p className="text-xs text-neutral-400 leading-relaxed" style={{ whiteSpace: 'pre-line' }}>
                        {typeof eventItem.data === "string"
                          ? eventItem.data
                          : Array.isArray(eventItem.data)
                          ? (eventItem.data as string[]).join(", ")
                          : JSON.stringify(eventItem.data)}
                      </p>
                    </div>
                  </div>
                ))}
                {isLoading && processedEvents.length > 0 && (
                  <div className="relative pl-8 pb-4 fade-slide-in">
                    <div className="absolute left-0.5 top-2 h-6 w-6 rounded-full bg-[var(--color-brand)]/20 flex items-center justify-center ring-4 ring-neutral-900 pulse-glow">
                      <Loader2 className="h-3 w-3 text-[var(--color-brand)] animate-spin" />
                    </div>
                    <div>
                      <p className="text-sm text-neutral-200 font-medium">
                        继续研究中...
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : !isLoading ? (
              <div className="flex flex-col items-center justify-center h-full text-neutral-500 pt-10">
                <Info className="h-8 w-8 mb-3 opacity-50" />
                <p className="text-sm">暂无活动记录</p>
                <p className="text-xs text-neutral-600 mt-1">
                  提交研究后，进度将在此显示
                </p>
              </div>
            ) : null}
          </CardContent>
        </ScrollArea>
      )}
    </Card>
  );
}

import { useState, FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader2, Brain, Database } from "lucide-react";

export function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setError(null);
    setLoading(true);

    try {
      await login(username.trim(), password);
    } catch (err: any) {
      setError(err.message || "登录失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-neutral-950 relative overflow-hidden">
      {/* 背景渐变装饰 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-blue-600/10 via-transparent to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-blue-600/5 via-transparent to-transparent rounded-full blur-3xl" />
      </div>

      {/* 登录卡片 */}
      <div className="relative z-10 w-full max-w-md mx-4 animate-fadeInUp">
        <div className="glass rounded-2xl shadow-2xl p-8 border border-white/5">
          {/* 品牌 Logo 区域 */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-brand-light)] flex items-center justify-center mb-4 shadow-lg">
              <Brain className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold gradient-text">Deep Research</h1>
            <p className="text-sm text-neutral-400 mt-2">企业级智能研究助手</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">用户名</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-neutral-800/50 border border-neutral-700 rounded-xl
                           text-neutral-100 placeholder-neutral-500
                           focus:outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/20
                           transition-all duration-200"
                placeholder="请输入用户名"
                autoComplete="username"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-neutral-800/50 border border-neutral-700 rounded-xl
                           text-neutral-100 placeholder-neutral-500
                           focus:outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/20
                           transition-all duration-200"
                placeholder="请输入密码"
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-400 text-sm text-center">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || !username.trim() || !password}
              className="w-full mt-2 py-3 bg-gradient-to-r from-[var(--color-brand)] to-[var(--color-brand-light)] hover:from-[var(--color-brand-light)] hover:to-[var(--color-brand)] text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 transition-all duration-300 hover:shadow-blue-500/40 hover:-translate-y-0.5"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  登录中...
                </>
              ) : (
                "登录"
              )}
            </Button>
          </form>

          {/* 底部信息 */}
          <div className="mt-6 pt-6 border-t border-neutral-700/50">
            <div className="flex items-center justify-center gap-2 text-xs text-neutral-500">
              <Database className="h-3 w-3" />
              <span>企业知识库 × 深度研究</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

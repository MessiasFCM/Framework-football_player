"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, UserPlus, Loader2, Search, Network, Trophy, GitCompareArrows, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/authContext";

type Mode = "signin" | "signup";

const FEATURES = [
  { icon: Search, text: "Busque jogadores por perfil textual em linguagem natural" },
  { icon: Network, text: "Receba recomendações de jogadores estatisticamente similares" },
  { icon: Trophy, text: "Gere rankings de desempenho por liga e posição" },
  { icon: GitCompareArrows, text: "Compare jogadores com relatórios visuais de similaridade" },
];

function PasswordInput({ value, onChange, placeholder, autoComplete }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-brand-500"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600"
        tabIndex={-1}
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-red-500 mt-1">{msg}</p>;
}

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading, signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const [nome, setNome] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [signupSenha, setSignupSenha] = useState("");
  const [confirmSenha, setConfirmSenha] = useState("");

  const [ferrors, setFerrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!authLoading && user) router.replace("/");
  }, [authLoading, user, router]);

  function switchMode(m: Mode) {
    setMode(m);
    setError("");
    setFerrors({});
  }

  function extractMsg(e: unknown): string {
    if (e instanceof Error) return e.message;
    if (typeof e === "object" && e !== null && "message" in e) return String((e as { message: unknown }).message);
    return "Erro inesperado.";
  }

  function validateEmail(v: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = "Informe o e-mail.";
    else if (!validateEmail(email)) errs.email = "E-mail inválido.";
    if (!senha) errs.senha = "Informe a senha.";
    if (Object.keys(errs).length) { setFerrors(errs); return; }

    setLoading(true);
    setError("");
    try {
      await signIn(email.trim(), senha);
      router.push("/");
    } catch (e: unknown) {
      setError(extractMsg(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!nome.trim()) errs.nome = "Informe seu nome.";
    if (!signupEmail.trim()) errs.signupEmail = "Informe o e-mail.";
    else if (!validateEmail(signupEmail)) errs.signupEmail = "E-mail inválido.";
    if (!confirmEmail.trim()) errs.confirmEmail = "Confirme o e-mail.";
    else if (confirmEmail.toLowerCase() !== signupEmail.toLowerCase()) errs.confirmEmail = "Os e-mails não coincidem.";
    if (!signupSenha) errs.signupSenha = "Informe a senha.";
    else if (signupSenha.length < 6) errs.signupSenha = "Mínimo de 6 caracteres.";
    if (!confirmSenha) errs.confirmSenha = "Confirme a senha.";
    else if (confirmSenha !== signupSenha) errs.confirmSenha = "As senhas não coincidem.";
    if (Object.keys(errs).length) { setFerrors(errs); return; }

    setLoading(true);
    setError("");
    try {
      await signUp(nome.trim(), signupEmail.trim(), signupSenha);
      router.push("/");
    } catch (e: unknown) {
      setError(extractMsg(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-gray-50">
      <div className="hidden lg:flex flex-col justify-center bg-zinc-900 text-white p-12">
        <div className="flex items-center gap-3 mb-6">
          <svg width={36} height={36} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="8" fill="#16a34a" />
            <rect x="6" y="18" width="4" height="8" rx="1" fill="white" />
            <rect x="14" y="12" width="4" height="14" rx="1" fill="white" />
            <rect x="22" y="6" width="4" height="20" rx="1" fill="white" />
          </svg>
          <span className="text-2xl font-bold tracking-tight">FutAnalytics</span>
        </div>
        <p className="text-zinc-300 text-base leading-relaxed mb-10 max-w-md">
          Dashboard interativo para análise e descoberta de jogadores de futebol das 10
          principais ligas do mundo na temporada 2024-25. Explore mais de 6.000 atletas de
          131 nacionalidades com estatísticas completas de desempenho.
        </p>
        <div className="space-y-5 max-w-md">
          {FEATURES.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                <Icon size={18} className="text-brand-500" />
              </div>
              <p className="text-sm text-zinc-300 leading-snug pt-1.5">{text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <svg width={28} height={28} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="32" height="32" rx="8" fill="#16a34a" />
              <rect x="6" y="18" width="4" height="8" rx="1" fill="white" />
              <rect x="14" y="12" width="4" height="14" rx="1" fill="white" />
              <rect x="22" y="6" width="4" height="20" rx="1" fill="white" />
            </svg>
            <span className="font-bold text-lg text-gray-900">FutAnalytics</span>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6">
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className={`flex-1 text-sm font-medium rounded-md py-1.5 transition-colors ${
                  mode === "signin" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className={`flex-1 text-sm font-medium rounded-md py-1.5 transition-colors ${
                  mode === "signup" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                }`}
              >
                Criar conta
              </button>
            </div>

            {mode === "signin" && (
              <>
                <h1 className="text-xl font-bold text-gray-900 mb-1">Bem-vindo de volta</h1>
                <p className="text-sm text-gray-500 mb-6">Entre com seu e-mail e senha.</p>
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">E-mail</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="voce@email.com"
                      autoComplete="email"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <FieldError msg={ferrors.email} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Senha</label>
                    <PasswordInput
                      value={senha}
                      onChange={setSenha}
                      placeholder="••••••••"
                      autoComplete="current-password"
                    />
                    <FieldError msg={ferrors.senha} />
                  </div>
                  {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-brand-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                    Entrar
                  </button>
                </form>
              </>
            )}

            {mode === "signup" && (
              <>
                <h1 className="text-xl font-bold text-gray-900 mb-1">Criar conta</h1>
                <p className="text-sm text-gray-500 mb-6">Preencha os campos para se cadastrar.</p>
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Nome</label>
                    <input
                      type="text"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Seu nome completo"
                      autoComplete="name"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <FieldError msg={ferrors.nome} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">E-mail</label>
                    <input
                      type="email"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      placeholder="voce@email.com"
                      autoComplete="email"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <FieldError msg={ferrors.signupEmail} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Confirmar e-mail</label>
                    <input
                      type="email"
                      value={confirmEmail}
                      onChange={(e) => setConfirmEmail(e.target.value)}
                      placeholder="voce@email.com"
                      autoComplete="off"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <FieldError msg={ferrors.confirmEmail} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Senha</label>
                    <PasswordInput
                      value={signupSenha}
                      onChange={setSignupSenha}
                      placeholder="Mínimo 6 caracteres"
                      autoComplete="new-password"
                    />
                    <FieldError msg={ferrors.signupSenha} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Confirmar senha</label>
                    <PasswordInput
                      value={confirmSenha}
                      onChange={setConfirmSenha}
                      placeholder="Repita a senha"
                      autoComplete="new-password"
                    />
                    <FieldError msg={ferrors.confirmSenha} />
                  </div>
                  {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-brand-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors mt-2"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                    Criar conta
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Modal } from "../common/Modal";
import { useAuthStore } from "../../store";
import { login, register, guestLogin } from "../../api/auth";

export function LoginModal({ onClose }: { onClose: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const setAuth = useAuthStore((s) => s.setAuth);

  const handleSubmit = async () => {
    try {
      setError("");
      const res = isRegister ? await register(username, password, email || undefined) : await login(username, password);
      setAuth(res.access_token, res.user); onClose();
    } catch (e) { setError(String(e)); }
  };

  const handleGuest = async () => {
    try {
      setError("");
      const res = await guestLogin();
      setAuth(res.access_token, res.user); onClose();
    } catch (e) { setError(String(e)); }
  };

  return (
    <Modal onClose={onClose}>
      <h2 className="text-sm font-semibold mb-4">{isRegister ? "注册" : "登录"}</h2>
      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
      <div className="space-y-2">
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="用户名" className="w-full text-xs border border-stone-300 dark:border-stone-700 rounded-subtle px-2 py-1.5 bg-white dark:bg-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-accent/30" />
        {isRegister && <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="邮箱（选填）" className="w-full text-xs border border-stone-300 dark:border-stone-700 rounded-subtle px-2 py-1.5 bg-white dark:bg-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-accent/30" />}
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="密码" className="w-full text-xs border border-stone-300 dark:border-stone-700 rounded-subtle px-2 py-1.5 bg-white dark:bg-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-accent/30" />
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={handleSubmit} className="flex-1 py-1.5 text-xs rounded-subtle bg-accent text-white hover:bg-accent-hover">{isRegister ? "注册" : "登录"}</button>
        <button onClick={handleGuest} className="py-1.5 text-xs text-stone-500 hover:text-stone-700 dark:hover:text-stone-300">访客</button>
      </div>
      <button onClick={() => setIsRegister(!isRegister)} className="text-xs text-stone-500 mt-2 hover:underline">{isRegister ? "已有账号？登录" : "没有账号？注册"}</button>
    </Modal>
  );
}

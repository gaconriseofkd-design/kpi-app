import { useState } from "react";

export default function PasswordModal({ isOpen, onClose, onSuccess, initialTitle = "Xác nhận mật mã" }) {
    const [password, setPassword] = useState("");
    const [error, setError] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (password === "04672") {
            onSuccess();
            setPassword("");
            setError(false);
            onClose();
        } else {
            setError(true);
            setPassword("");
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-sm overflow-hidden border border-white animate-in fade-in zoom-in duration-200">
                <div className="bg-indigo-900 p-8 text-center relative">
                    <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">{initialTitle}</h3>
                    <button
                        onClick={() => { onClose(); setPassword(""); setError(false); }}
                        className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nhập PASSWORD</label>
                        <input
                            autoFocus
                            type="password"
                            className={`w-full p-4 bg-slate-50 border-2 rounded-2xl outline-none transition-all text-center text-2xl font-black tracking-[0.5em] ${error ? 'border-red-400 bg-red-50 text-red-600 animate-shake' : 'border-slate-100 focus:border-indigo-500 text-slate-700'}`}
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); setError(false); }}
                            placeholder="•••••"
                        />
                        {error && <p className="text-red-500 text-[10px] font-black text-center uppercase mt-2">Mật mã không chính xác</p>}
                    </div>

                    <button
                        type="submit"
                        className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all uppercase tracking-widest text-sm"
                    >
                        Xác nhận
                    </button>
                </form>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    75% { transform: translateX(5px); }
                }
                .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
            `}} />
        </div>
    );
}

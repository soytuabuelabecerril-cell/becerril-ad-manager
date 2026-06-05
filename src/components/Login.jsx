import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { BookOpen, Lock, Mail, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const Login = () => {
  const { language } = useLanguage();
  const isEs = language === 'es';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError(isEs ? 'Por favor, rellene todos los campos' : 'Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });

      if (authError) {
        // Localize basic error messages
        let errMsg = authError.message;
        if (isEs) {
          if (authError.message.includes('Invalid login credentials')) {
            errMsg = 'Credenciales de acceso no válidas';
          } else if (authError.message.includes('Email not confirmed')) {
            errMsg = 'Correo electrónico no confirmado. Por favor compruébelo';
          }
        }
        setError(errMsg);
      }
    } catch (err) {
      setError(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 relative overflow-hidden font-sans">
      {/* Decorative Glow Elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[6000ms]"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none animate-pulse duration-[8000ms]"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      {/* Main Container */}
      <div className="w-full max-w-md p-6 relative z-10">
        
        {/* Logo/Branding */}
        <div className="flex flex-col items-center mb-8 animate-fade-in duration-700">
          <div className="w-16 h-16 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/30 mb-4 scale-100 hover:scale-105 hover:rotate-3 transition-transform duration-300">
            <BookOpen className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-400">
            Revista de Fiestas Patronales Becerril de la Sierra 2026
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {isEs ? 'Plataforma de Gestión de Anuncios' : 'Ad Management Platform'}
          </p>
        </div>

        {/* Glass Card */}
        <div className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] rounded-3xl p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
          
          {/* Card Top Border Gradient Accent */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>

          <h2 className="text-xl font-semibold text-white mb-6">
            {isEs ? 'Iniciar Sesión' : 'Sign In'}
          </h2>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-500/30 flex items-start gap-3 text-red-300 text-sm animate-in slide-in-from-top-2 duration-200">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                {isEs ? 'Correo Electrónico' : 'Email Address'}
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <Mail className="w-5 h-5" />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isEs ? 'ejemplo@correo.com' : 'you@example.com'}
                  className="w-full pl-12 pr-4 py-3 bg-slate-900/60 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 text-sm"
                  autoFocus
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                {isEs ? 'Contraseña' : 'Password'}
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <Lock className="w-5 h-5" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isEs ? '••••••••' : '••••••••'}
                  className="w-full pl-12 pr-12 py-3 bg-slate-900/60 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Action Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all duration-300 scale-100 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {isEs ? 'Autenticando...' : 'Signing In...'}
                </>
              ) : (
                <>{isEs ? 'Ingresar' : 'Sign In'}</>
              )}
            </button>
          </form>

        </div>

        {/* Footer info */}
        <div className="text-center mt-6 text-xs text-slate-500">
          &copy; {new Date().getFullYear()} Revista de Fiestas Patronales Becerril de la Sierra 2026. {isEs ? 'Todos los derechos reservados.' : 'All rights reserved.'}
        </div>

      </div>
    </div>
  );
};

export default Login;

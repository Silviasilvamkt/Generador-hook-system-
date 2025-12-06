
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { RAW_HOOKS } from './constants';
import { FormData, GeneratedHook } from './types';
import HookCard from './components/HookCard';

const App: React.FC = () => {
  // --- AUTH STATE ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Login Inputs
  const [loginEmail, setLoginEmail] = useState('');
  const [loginCode, setLoginCode] = useState('');
  const [authError, setAuthError] = useState('');

  // App State
  const [formData, setFormData] = useState<FormData>({
    niche: '',
    topic: '',
    audience: ''
  });
  
  const [generatedHooks, setGeneratedHooks] = useState<GeneratedHook[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchIndex, setBatchIndex] = useState(0);
  const hooksContainerRef = useRef<HTMLDivElement>(null);

  const BATCH_SIZE = 10;

  // --- AUTH CHECK ON MOUNT ---
  useEffect(() => {
    const savedAuth = localStorage.getItem('hook_system_auth');
    if (savedAuth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const validateEmail = (email: string) => {
    return email && email.includes('@') && email.includes('.');
  };

  const handleLogin = () => {
    setAuthError('');
    
    // 1. Validate Email
    if (!validateEmail(loginEmail)) {
      setAuthError('Por favor ingresa un correo electrónico válido para entrar.');
      return;
    }

    // 2. Validate Code input presence
    if (!loginCode.trim()) {
        setAuthError('Por favor ingresa tu código de acceso.');
        return;
    }

    // 3. Validate Code Match
    // process.env.ACCESS_CODES is injected by vite.config.ts
    const validCodesString = process.env.ACCESS_CODES || "";
    const validCodes = validCodesString.split(',').map(c => c.trim()).filter(c => c !== "");

    // Check if the input code matches any valid code (case insensitive)
    if (validCodes.some(code => code.toLowerCase() === loginCode.trim().toLowerCase())) {
      setIsAuthenticated(true);
      localStorage.setItem('hook_system_auth', 'true');
      setAuthError('');
    } else {
      setAuthError('Código de acceso incorrecto. Verifica o solicita uno nuevo abajo.');
    }
  };

  // --- MAIN APP LOGIC ---

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const getAIClient = () => {
    const rawKey = process.env.API_KEY || "";
    const apiKey = rawKey.trim();
    
    if (!apiKey || apiKey === "" || apiKey === "undefined") {
      throw new Error("API_KEY_MISSING");
    }
    return new GoogleGenAI({ apiKey });
  };

  const generateHooks = async (isLoadMore: boolean = false) => {
    if (!formData.niche || !formData.topic) {
      setError("Por favor completa el nicho y la idea principal.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const ai = getAIClient();

      const start = isLoadMore ? (batchIndex + 1) * BATCH_SIZE : 0;
      const end = start + BATCH_SIZE;
      
      if (!isLoadMore) {
        setGeneratedHooks([]);
        setBatchIndex(0);
      }

      const templatesToAdapt = RAW_HOOKS.slice(start, end);

      if (templatesToAdapt.length === 0) {
        setLoading(false);
        return;
      }

      const prompt = `
        Act as a professional copywriter and viral content expert.
        
        CONTEXT:
        The user wants to adapt viral hook templates to their specific niche.
        - User Niche: "${formData.niche}"
        - Video Topic/Idea: "${formData.topic}"
        - Target Audience: "${formData.audience || "General audience within the niche"}"

        TASK:
        I will provide a list of templates containing placeholders like [tema], [resultado], [número], etc.
        You must adapt each template to be grammatically correct (Spanish), engaging, and relevant to the user's input.

        RULES:
        1. Replace ALL placeholders ([...]) with specific terms related to the Niche and Topic.
        2. Do NOT leave any brackets [] in the final output.
        3. Maintain the psychological trigger (curiosity, fear, gain) of the original hook.
        4. Keep the output in Spanish.
        5. Return ONLY a JSON array of strings. No markdown formatting.

        TEMPLATES TO ADAPT:
        ${JSON.stringify(templatesToAdapt)}
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });

      const responseText = response.text;
      if (!responseText) throw new Error("No response from AI");

      let adaptedStrings: string[] = [];
      try {
        adaptedStrings = JSON.parse(responseText);
      } catch (e) {
        const cleanText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        adaptedStrings = JSON.parse(cleanText);
      }

      const newHooks: GeneratedHook[] = adaptedStrings.map((text, index) => ({
        id: start + index,
        originalTemplateId: start + index,
        text: text
      }));

      if (isLoadMore) {
        setGeneratedHooks(prev => [...prev, ...newHooks]);
        setBatchIndex(prev => prev + 1);
      } else {
        setGeneratedHooks(newHooks);
        setBatchIndex(0);
      }

    } catch (err: any) {
      console.error("AI Error:", err);
      let errorMessage = "Hubo un error generando los hooks. Por favor intenta de nuevo.";
      
      if (err.message === "API_KEY_MISSING") {
        errorMessage = "Error de Configuración: Falta la API KEY en Vercel.";
      } else if (err.toString().includes("429")) {
        errorMessage = "⏳ Límite gratuito alcanzado. Espera 10 segundos e intenta de nuevo.";
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // --- LOGIN SCREEN RENDER ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-black px-4 font-sans py-10">
        <div className="bg-white p-8 md:p-10 rounded-lg shadow-2xl max-w-md w-full border-t-4 border-brand-gold relative overflow-hidden animate-fade-in">
          
          <div className="text-center mb-8 relative z-10">
            <h1 className="text-3xl md:text-4xl font-serif text-brand-black mb-2">Acceso Exclusivo</h1>
            <p className="text-brand-gold uppercase tracking-widest text-xs font-bold">Incubadora PRO FS</p>
          </div>
          
          <div className="space-y-8 relative z-10">
            
            {/* --- SECTION 1: LOGIN --- */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide border-b border-gray-100 pb-2">
                1. Ingresar con Código
              </h2>
              
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Tu Correo (Registrado):</label>
                <input 
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  className="w-full bg-gray-50 border border-gray-300 px-4 py-2 rounded focus:outline-none focus:border-brand-black transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Tu Código de Acceso:</label>
                <input 
                  type="text"
                  value={loginCode}
                  onChange={(e) => setLoginCode(e.target.value)}
                  placeholder="Código VIP"
                  className="w-full bg-gray-50 border border-gray-300 px-4 py-2 rounded focus:outline-none focus:border-brand-black transition-colors"
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>

              {authError && (
                 <p className="text-brand-red text-xs font-bold">{authError}</p>
              )}

              <button
                onClick={handleLogin}
                className="w-full bg-brand-black text-white font-bold py-3 rounded hover:bg-gray-800 transition-all uppercase tracking-widest text-xs shadow-md"
              >
                Ingresar al Sistema
              </button>
            </div>

            {/* DIVIDER */}
            <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-200"></div>
                <span className="flex-shrink-0 mx-4 text-gray-300 text-xs uppercase tracking-widest">O</span>
                <div className="flex-grow border-t border-gray-200"></div>
            </div>

            {/* --- SECTION 2: REQUEST ACCESS (PURE HTML FORM) --- */}
            <div className="bg-gray-50 p-4 rounded border border-gray-100">
               <h3 className="text-sm font-bold text-brand-gold mb-2 text-center">¿Aún no tienes código?</h3>
               <p className="text-xs text-gray-500 text-center mb-4">
                 Solicítalo gratis enviando tu correo a nuestro equipo.
               </p>
               
               {/* 
                  Standard HTML Form. 
                  REMOVED target="_blank" to ensure functionality on mobile devices.
                  The user will be redirected to the FormSubmit success page.
               */}
               <form 
                  action="https://formsubmit.co/silvia.silvatorres@gmail.com" 
                  method="POST"
                  className="w-full"
               >
                   <input type="hidden" name="_subject" value="Nueva Solicitud - Hook Generator" />
                   <input type="hidden" name="_template" value="table" />
                   <input type="hidden" name="_captcha" value="true" />

                   <div className="flex flex-col gap-2">
                     <input 
                        type="email" 
                        name="email" 
                        required 
                        placeholder="Escribe tu correo aquí..." 
                        className="w-full border border-gray-300 px-3 py-2 text-sm rounded focus:border-brand-gold focus:outline-none"
                     />
                     <button
                      type="submit"
                      className="w-full border border-brand-gold text-brand-gold font-bold py-2 rounded hover:bg-brand-gold hover:text-white transition-colors text-xs uppercase tracking-widest"
                    >
                      Enviar Solicitud
                    </button>
                   </div>
               </form>
               
               {/* Manual Fallback Link */}
               <div className="mt-3 text-center">
                 <a 
                   href="mailto:silvia.silvatorres@gmail.com?subject=Solicitud Acceso Hook System"
                   className="text-[10px] text-gray-400 underline hover:text-brand-gold transition-colors"
                 >
                   ¿Problemas? Enviar correo manualmente
                 </a>
               </div>
            </div>

            <div className="text-center pt-2">
               <p className="text-[10px] text-gray-400 font-serif italic">
                 Silvia Silva & Luis Figuerola
               </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- APP RENDER (AUTHENTICATED) ---
  return (
    <div className="min-h-screen flex flex-col font-sans bg-white text-brand-black">
      
      {/* Header */}
      <header className="py-8 px-4 md:px-8 border-b border-gray-100 bg-white sticky top-0 z-50 shadow-sm bg-opacity-95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-center md:text-left">
            <h1 className="text-2xl md:text-3xl font-serif text-brand-black tracking-tight">
              Hook Generator System
            </h1>
            <p className="text-brand-gold text-xs font-bold tracking-widest uppercase mt-1">
              Incubadora PRO FS
            </p>
          </div>
          <button 
            onClick={() => {
              localStorage.removeItem('hook_system_auth');
              setIsAuthenticated(false);
              setLoginEmail('');
              setLoginCode('');
            }}
            className="text-xs text-gray-400 hover:text-brand-red uppercase tracking-widest underline transition-colors"
          >
            Cerrar Sesión
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow container mx-auto px-4 md:px-8 py-10 max-w-4xl">
        
        {/* Input Section */}
        <section className="mb-16">
          <div className="bg-brand-gray p-8 md:p-12 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-2xl font-serif mb-8 text-brand-black text-center md:text-left">Configura tu Generador</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              <div className="col-span-1">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  1. Tu Nicho
                </label>
                <input
                  type="text"
                  name="niche"
                  value={formData.niche}
                  onChange={handleInputChange}
                  placeholder="Ej. Fitness, Bienes Raíces..."
                  className="w-full bg-white border-b-2 border-gray-300 px-4 py-3 text-lg focus:outline-none focus:border-brand-gold transition-colors placeholder-gray-300"
                />
              </div>

              <div className="col-span-1">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  2. Idea / Tema
                </label>
                <input
                  type="text"
                  name="topic"
                  value={formData.topic}
                  onChange={handleInputChange}
                  placeholder="Ej. Dieta Keto, Vender sin vender..."
                  className="w-full bg-white border-b-2 border-gray-300 px-4 py-3 text-lg focus:outline-none focus:border-brand-gold transition-colors placeholder-gray-300"
                />
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  3. Audiencia (Opcional)
                </label>
                <input
                  type="text"
                  name="audience"
                  value={formData.audience}
                  onChange={handleInputChange}
                  placeholder="Ej. Principiantes, Expertos..."
                  className="w-full bg-white border-b-2 border-gray-300 px-4 py-3 text-lg focus:outline-none focus:border-brand-gold transition-colors placeholder-gray-300"
                />
              </div>
            </div>

            {error && (
              <div className="mt-8 p-4 bg-red-50 border-l-4 border-brand-red rounded-r animate-fade-in">
                 <p className="text-brand-red font-bold text-center text-sm md:text-base">
                  {error}
                </p>
              </div>
            )}

            <div className="mt-12 flex justify-center">
              <button
                onClick={() => generateHooks(false)}
                disabled={loading}
                className="bg-brand-red text-white font-bold py-4 px-12 rounded-sm hover:bg-red-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest text-sm"
              >
                {loading && generatedHooks.length === 0 ? 'Analizando...' : 'Generar Hooks Virales'}
              </button>
            </div>
          </div>
        </section>

        {/* Results Section */}
        {generatedHooks.length > 0 && (
          <section ref={hooksContainerRef} className="animate-fade-in">
            <div className="flex items-center gap-4 mb-8">
               <div className="h-px bg-gray-200 flex-grow"></div>
               <h3 className="text-2xl font-serif text-brand-black px-4">Resultados Adaptados</h3>
               <div className="h-px bg-gray-200 flex-grow"></div>
            </div>
            
            <div className="grid gap-6">
              {generatedHooks.map((hook) => (
                <HookCard key={hook.id} hook={hook} />
              ))}
            </div>

            <div className="mt-16 text-center pb-12">
               <button
                onClick={() => generateHooks(true)}
                disabled={loading}
                className="bg-white border-2 border-brand-black text-brand-black font-bold py-3 px-8 hover:bg-brand-black hover:text-white transition-all duration-300 uppercase text-xs tracking-widest disabled:opacity-50 rounded-sm"
              >
                {loading ? 'Cargando...' : 'Cargar más fórmulas'}
              </button>
            </div>
          </section>
        )}

      </main>

      {/* Footer */}
      <footer className="bg-brand-black text-white py-16 text-center border-t-4 border-brand-gold">
        <div className="container mx-auto px-4">
          <p className="font-serif text-3xl text-brand-gold mb-4">Incubadora PRO FS</p>
          <div className="max-w-md mx-auto h-px bg-gray-800 mb-6"></div>
          <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">
            Presentado por
          </p>
          <p className="text-white text-base mb-8 font-light">
            Silvia Silva & Luis Figuerola
          </p>
          
          <div className="text-[10px] text-gray-600 uppercase tracking-widest">
            &copy; {new Date().getFullYear()} Hook Generator System.
          </div>
        </div>
      </footer>

    </div>
  );
};

export default App;

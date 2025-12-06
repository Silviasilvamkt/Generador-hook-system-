
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { RAW_HOOKS } from './constants';
import { FormData, GeneratedHook } from './types';
import HookCard from './components/HookCard';

const App: React.FC = () => {
  // --- AUTH STATE ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessCodeInput, setAccessCodeInput] = useState('');
  const [emailInput, setEmailInput] = useState(''); // New email state
  const [authError, setAuthError] = useState('');

  // --- APP STATE ---
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
    if (!validateEmail(emailInput)) {
      setAuthError('Por favor ingresa un correo electrónico válido antes de entrar.');
      return;
    }

    // 2. Validate Code input presence
    if (!accessCodeInput.trim()) {
        setAuthError('Por favor ingresa tu código de acceso.');
        return;
    }

    // 3. Validate Code Match
    // process.env.ACCESS_CODES is injected by vite.config.ts
    const validCodesString = process.env.ACCESS_CODES || "";
    // Clean and split codes
    const validCodes = validCodesString.split(',').map(c => c.trim()).filter(c => c !== "");

    // Check if the input code matches any valid code (case insensitive)
    if (validCodes.some(code => code.toLowerCase() === accessCodeInput.trim().toLowerCase())) {
      setIsAuthenticated(true);
      localStorage.setItem('hook_system_auth', 'true');
      setAuthError('');
    } else {
      setAuthError('Código de acceso incorrecto. Verifica que esté bien escrito o solicita uno nuevo.');
    }
  };

  const handleRequestAccess = () => {
    setAuthError('');

    // Check if email is entered so we can include it in the mailto body
    if (!validateEmail(emailInput)) {
        const msg = '⚠️ Por favor escribe tu correo electrónico en el campo de arriba para solicitar el acceso.';
        setAuthError(msg);
        alert(msg);
        return;
    }

    // Opens user's email client to request access
    const adminEmail = "silvia.silvatorres@gmail.com";
    const subject = encodeURIComponent("Solicitud de Acceso VIP - Hook Generator System");
    // We include the user's email in the body to make it easy for you to see who is asking
    const body = encodeURIComponent(`Hola Silvia,\n\nMe gustaría solicitar acceso al Hook Generator System.\n\nMi correo de registro es: ${emailInput}\n\nQuedo a la espera de mi código de acceso.\n\nGracias.`);
    
    window.location.href = `mailto:${adminEmail}?subject=${subject}&body=${body}`;
  };

  // --- MAIN APP LOGIC ---

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const getAIClient = () => {
    // Safety check for empty API Key to avoid crashes
    // We clean the key to remove potential accidental whitespaces from copy-pasting
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
        5. Return ONLY a JSON array of strings. No markdown formatting, just the raw array.

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
        // Fallback if model returns markdown code block despite schema config
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
        errorMessage = "Error de Configuración: Falta la API KEY en Vercel. Ve a Settings > Environment Variables y agrega 'API_KEY'.";
      } else if (err.toString().includes("429") || err.toString().includes("Too Many Requests")) {
        errorMessage = "⏳ Límite de tráfico gratuito alcanzado. El sistema está recargando energía. Por favor espera 10 segundos e intenta nuevamente.";
      } else if (err.toString().includes("403") || err.toString().includes("API key not valid")) {
        errorMessage = "Error de Acceso: La API Key configurada no es válida. Revisa tu configuración en Vercel.";
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // --- LOGIN SCREEN RENDER ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-black px-4 font-sans">
        <div className="bg-white p-8 md:p-12 rounded-lg shadow-2xl max-w-md w-full border-t-4 border-brand-gold relative overflow-hidden animate-fade-in">
          
          <div className="text-center mb-6 relative z-10">
            <h1 className="text-3xl md:text-4xl font-serif text-brand-black mb-2">Acceso Exclusivo</h1>
            <p className="text-brand-gold uppercase tracking-widest text-xs font-bold">Incubadora PRO FS</p>
          </div>
          
          <div className="space-y-6 relative z-10">
            
            {/* Common Email Field */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                1. Tu Correo Electrónico
              </label>
              <input 
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="tu@correo.com"
                className="w-full bg-gray-50 border-b-2 border-gray-300 px-4 py-3 text-lg focus:outline-none focus:border-brand-gold transition-colors text-brand-black placeholder-gray-400"
              />
            </div>

            {/* ERROR MESSAGE DISPLAY */}
            {authError && (
               <div className="bg-red-50 border-l-4 border-brand-red p-3 rounded-r">
                 <p className="text-brand-red text-sm font-medium">
                   {authError}
                 </p>
               </div>
            )}

            <hr className="border-gray-100 my-4" />

            {/* Option A: Have Code */}
            <div className="space-y-4">
              <p className="text-sm font-semibold text-brand-black">¿Ya tienes tu código?</p>
              
              <div className="relative">
                <input 
                  type="text"
                  value={accessCodeInput}
                  onChange={(e) => setAccessCodeInput(e.target.value)}
                  placeholder="Ingresa tu Código VIP"
                  className="w-full bg-gray-50 border border-gray-300 rounded px-4 py-3 text-base focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold transition-colors text-brand-black"
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>

              <button
                onClick={handleLogin}
                className="w-full bg-brand-black text-white font-bold py-3 rounded-sm hover:bg-gray-900 transition-all duration-300 uppercase tracking-widest text-sm shadow-md hover:shadow-lg"
              >
                Ingresar
              </button>
            </div>

            <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-200"></div>
                <span className="flex-shrink-0 mx-4 text-gray-300 text-xs uppercase tracking-widest">O</span>
                <div className="flex-grow border-t border-gray-200"></div>
            </div>

            {/* Option B: Request Code */}
            <div className="text-center space-y-3">
               <p className="text-sm text-gray-600">¿Aún no tienes código?</p>
               <button
                onClick={handleRequestAccess}
                className="w-full bg-white border border-brand-gold text-brand-gold font-bold py-2 rounded-sm hover:bg-brand-gold hover:text-white transition-all duration-300 uppercase tracking-widest text-xs"
              >
                Solicitar Acceso Ahora
              </button>
              
              {/* Fallback info if mailto fails */}
              <div className="text-[10px] text-gray-400 mt-2 bg-gray-50 p-2 rounded">
                <p>¿No se abrió el correo?</p>
                <p>Escribe a: <span className="font-mono text-brand-black">silvia.silvatorres@gmail.com</span></p>
                <p>Asunto: Solicitud Acceso Hook System</p>
              </div>
            </div>

            <div className="text-center mt-6 pt-4 border-t border-gray-50">
               <p className="text-xs text-gray-400 font-serif italic">
                 Silvia Silva y Luis Figuerola
               </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- APP RENDER ---
  return (
    <div className="min-h-screen flex flex-col font-sans bg-white text-brand-black">
      
      {/* Header Section */}
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
              setEmailInput('');
              setAccessCodeInput('');
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
                  placeholder="Ej. Fitness para mujeres, Bienes Raíces..."
                  className="w-full bg-white border-b-2 border-gray-300 px-4 py-3 text-lg focus:outline-none focus:border-brand-gold transition-colors placeholder-gray-300"
                />
              </div>

              <div className="col-span-1">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  2. Idea / Tema del Video
                </label>
                <input
                  type="text"
                  name="topic"
                  value={formData.topic}
                  onChange={handleInputChange}
                  placeholder="Ej. Dieta Keto, Cómo vender casas..."
                  className="w-full bg-white border-b-2 border-gray-300 px-4 py-3 text-lg focus:outline-none focus:border-brand-gold transition-colors placeholder-gray-300"
                />
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  3. Audiencia Objetivo (Opcional)
                </label>
                <input
                  type="text"
                  name="audience"
                  value={formData.audience}
                  onChange={handleInputChange}
                  placeholder="Ej. Madres ocupadas, Inversionistas primerizos..."
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
                {loading && generatedHooks.length === 0 ? 'Analizando Estrategia...' : 'Generar Hooks Virales'}
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
                {loading ? 'Procesando...' : 'Cargar siguientes 10 fórmulas'}
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
            &copy; {new Date().getFullYear()} Hook Generator System. Todos los derechos reservados.
          </div>
        </div>
      </footer>

    </div>
  );
};

export default App;

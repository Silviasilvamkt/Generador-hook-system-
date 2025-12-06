import React, { useState, useRef } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { RAW_HOOKS } from './constants';
import { FormData, GeneratedHook } from './types';
import HookCard from './components/HookCard';

const App: React.FC = () => {
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const getAIClient = () => {
    // Check if the API Key was injected correctly by Vite
    // We trim() to remove accidental whitespace from copy-pasting
    const apiKey = process.env.API_KEY ? process.env.API_KEY.trim() : "";
    
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
      // Initialize AI client here to catch configuration errors
      const ai = getAIClient();

      // Calculate which raw templates to use
      const start = isLoadMore ? (batchIndex + 1) * BATCH_SIZE : 0;
      const end = start + BATCH_SIZE;
      
      // If we are starting over
      if (!isLoadMore) {
        setGeneratedHooks([]);
        setBatchIndex(0);
      }

      const templatesToAdapt = RAW_HOOKS.slice(start, end);

      if (templatesToAdapt.length === 0) {
        setLoading(false);
        return; // No more templates
      }

      // Construct Prompt
      const prompt = `
        Act as a viral content expert. I have a user with the following profile:
        - Niche: ${formData.niche}
        - Topic/Idea: ${formData.topic}
        - Target Audience: ${formData.audience || "General audience within the niche"}

        I have a list of viral hook templates with placeholders like [tema], [resultado], [número], etc.
        Your task is to ADAPT these templates to be specific, grammatical, and engaging for the user's niche and topic.
        
        Rules:
        1. Replace placeholders ([...]) with specific, high-impact words related to the Niche and Topic.
        2. Keep the viral structure and psychological trigger of the original template.
        3. Maintain the original numbering if present, or just return the text.
        4. Return ONLY the adapted list in a JSON array of strings.
        5. Use Spanish.
        
        Templates to adapt:
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

      const adaptedStrings: string[] = JSON.parse(responseText);

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
      
      // Handle specific errors
      if (err.message === "API_KEY_MISSING") {
        errorMessage = "Falta la API KEY en Vercel. Ve a Settings > Environment Variables y agrega 'API_KEY'.";
      } else if (err.toString().includes("429") || err.toString().includes("Too Many Requests")) {
        errorMessage = "¡Mucha creatividad por hoy! Hemos alcanzado el límite gratuito momentáneo. Espera 30 segundos e intenta de nuevo.";
      } else if (err.toString().includes("403") || err.toString().includes("API key not valid")) {
        errorMessage = "La API Key no es válida o ha expirado. Por favor verifica en Vercel.";
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-white text-brand-black">
      
      {/* Header Section */}
      <header className="py-12 px-4 md:px-8 border-b border-gray-100 bg-white sticky top-0 z-50 shadow-sm bg-opacity-95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-serif text-brand-black mb-2 tracking-tight">
            Hook Generator System
          </h1>
          <p className="text-brand-gold text-lg md:text-xl font-medium tracking-wide uppercase text-sm">
            Incubadora PRO FS
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow container mx-auto px-4 md:px-8 py-10 max-w-4xl">
        
        {/* Input Section */}
        <section className="mb-16">
          <div className="bg-brand-gray p-8 md:p-10 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-2xl font-serif mb-6 text-brand-black">Configura tu Generador</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="col-span-1">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Tu Nicho
                </label>
                <input
                  type="text"
                  name="niche"
                  value={formData.niche}
                  onChange={handleInputChange}
                  placeholder="Ej. Fitness, Marketing, Bienes Raíces..."
                  className="w-full bg-white border-b-2 border-gray-300 px-4 py-3 text-lg focus:outline-none focus:border-brand-gold transition-colors placeholder-gray-300"
                />
              </div>

              <div className="col-span-1">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Idea / Tema del Video
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
                  Audiencia Objetivo (Opcional)
                </label>
                <input
                  type="text"
                  name="audience"
                  value={formData.audience}
                  onChange={handleInputChange}
                  placeholder="Ej. Madres ocupadas, Dueños de agencias..."
                  className="w-full bg-white border-b-2 border-gray-300 px-4 py-3 text-lg focus:outline-none focus:border-brand-gold transition-colors placeholder-gray-300"
                />
              </div>
            </div>

            {error && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md animate-fade-in">
                 <p className="text-brand-red font-bold text-center text-sm md:text-base">
                  {error}
                </p>
              </div>
            )}

            <div className="mt-10 flex justify-center">
              <button
                onClick={() => generateHooks(false)}
                disabled={loading}
                className="bg-brand-red text-white font-bold py-4 px-10 rounded-sm hover:bg-red-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest text-sm"
              >
                {loading && generatedHooks.length === 0 ? 'Generando Estrategia...' : 'Generar Hooks Virales'}
              </button>
            </div>
          </div>
        </section>

        {/* Results Section */}
        {generatedHooks.length > 0 && (
          <section ref={hooksContainerRef} className="animate-fade-in">
            <h3 className="text-3xl font-serif mb-8 text-brand-black border-l-4 border-brand-gold pl-4">
              Tus Hooks Adaptados
            </h3>
            
            <div className="grid gap-6">
              {generatedHooks.map((hook) => (
                <HookCard key={hook.id} hook={hook} />
              ))}
            </div>

            <div className="mt-12 text-center pb-12">
               <button
                onClick={() => generateHooks(true)}
                disabled={loading}
                className="bg-white border-2 border-brand-black text-brand-black font-bold py-3 px-8 hover:bg-brand-black hover:text-white transition-all duration-300 uppercase text-xs tracking-widest disabled:opacity-50"
              >
                {loading ? 'Pensando...' : 'Cargar siguientes 10 fórmulas'}
              </button>
            </div>
          </section>
        )}

      </main>

      {/* Footer */}
      <footer className="bg-brand-black text-white py-12 text-center">
        <div className="container mx-auto px-4">
          <p className="font-serif text-2xl text-brand-gold mb-2">Incubadora PRO FS</p>
          <p className="text-gray-400 text-sm font-light uppercase tracking-widest">
            Silvia Silva y Luis Figuerola presentan
          </p>
          <p className="text-white font-bold text-lg mt-2">Hook Generator System</p>
          <div className="mt-8 text-xs text-gray-600">
            &copy; {new Date().getFullYear()} Todos los derechos reservados.
          </div>
        </div>
      </footer>

    </div>
  );
};

export default App;
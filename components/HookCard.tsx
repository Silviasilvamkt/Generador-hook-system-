import React, { useState } from 'react';
import { GeneratedHook } from '../types';

interface HookCardProps {
  hook: GeneratedHook;
}

const HookCard: React.FC<HookCardProps> = ({ hook }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(hook.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border-l-4 border-brand-gold shadow-sm p-6 hover:shadow-md transition-shadow duration-300 rounded-r-lg group">
      <div className="flex justify-between items-start gap-4">
        <p className="text-xl font-medium text-brand-black leading-snug font-sans">
          {hook.text}
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={handleCopy}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors duration-200 border ${
            copied
              ? 'bg-green-100 text-green-700 border-green-200'
              : 'bg-transparent text-brand-black border-gray-300 hover:border-brand-gold hover:text-brand-gold'
          }`}
        >
          {copied ? '¡Copiado!' : 'Copiar Hook'}
        </button>
      </div>
    </div>
  );
};

export default HookCard;
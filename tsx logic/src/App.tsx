import React, { useState } from 'react';
import { 
  Code2, 
  Clipboard, 
  Check, 
  Trash2, 
  FileCode, 
  AlertCircle,
  Sparkles,
  Search,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ExtractedBlock {
  id: string;
  code: string;
  type: 'tsx' | 'ts' | 'jsx' | 'js';
  fileName?: string;
}

export const App: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [extractedBlocks, setExtractedBlocks] = useState<ExtractedBlock[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const extractCode = () => {
    setIsProcessing(true);
    
    // Regex logic to find code blocks
    // 1. Markdown style: ```tsx ... ```
    // 2. Heuristic: Look for JSX patterns <Component ... /> or import React
    
    const blocks: ExtractedBlock[] = [];
    
    // Pattern 1: Markdown blocks
    const mdRegex = /```(tsx|typescript|jsx|javascript)\n([\s\S]*?)```/g;
    let match;
    while ((match = mdRegex.exec(inputText)) !== null) {
      blocks.push({
        id: Math.random().toString(36).substr(2, 9),
        type: (match[1] === 'typescript' ? 'ts' : match[1]) as any,
        code: match[2].trim()
      });
    }

    // Pattern 2: Heuristic for blocks not in triple backticks (if no markdown found)
    if (blocks.length === 0) {
      // Simple fallback if it looks like code but isn't wrapped
      if (inputText.includes('import') || (inputText.includes('<') && inputText.includes('/>'))) {
         // If the whole thing looks like code, treat as one block
         blocks.push({
           id: 'auto-1',
           type: 'tsx',
           code: inputText.trim()
         });
      }
    }

    setExtractedBlocks(blocks);
    setIsProcessing(false);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const downloadCode = (code: string, type: string) => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extracted-component.${type}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearAll = () => {
    setInputText('');
    setExtractedBlocks([]);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-slate-200 font-sans selection:bg-cyan-500/30">
      {/* Navbar */}
      <nav className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Code2 className="text-white w-6 h-6" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60 tracking-tight">
              TSX Extractor
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-6 text-sm font-medium text-slate-400">
            <a href="#" className="hover:text-cyan-400 transition-colors">How it works</a>
            <a href="#" className="hover:text-cyan-400 transition-colors">GitHub</a>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-2 gap-10">
          
          {/* Input Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-cyan-500 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Input Source
              </h2>
              {inputText && (
                <button 
                  onClick={clearAll}
                  className="text-xs text-slate-500 hover:text-red-400 flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
            
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition duration-1000"></div>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste your logs, documentation, or mixed text here... (e.g. Markdown with code blocks)"
                className="relative w-full h-[600px] bg-[#121214] border border-white/10 rounded-2xl p-6 text-sm font-mono focus:outline-none focus:border-cyan-500/50 transition-all resize-none placeholder:text-slate-600 shadow-2xl"
              />
            </div>

            <button
              onClick={extractCode}
              disabled={!inputText || isProcessing}
              className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-white shadow-xl shadow-cyan-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Extract TSX Blocks
                </>
              )}
            </button>
          </div>

          {/* Output Section */}
          <div className="space-y-6">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-blue-500 flex items-center gap-2">
              <FileCode className="w-4 h-4" />
              Extracted Results
            </h2>

            <div className="space-y-4 min-h-[600px] rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4">
              <AnimatePresence mode="popLayout">
                {extractedBlocks.length > 0 ? (
                  extractedBlocks.map((block) => (
                    <motion.div
                      key={block.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-[#121214] border border-white/10 rounded-xl overflow-hidden group/card shadow-lg"
                    >
                      <div className="px-4 py-2 bg-white/[0.03] border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 text-[10px] font-bold uppercase">
                            {block.type}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover/card:opacity-100 transition-opacity">
                          <button 
                            onClick={() => downloadCode(block.code, block.type)}
                            className="p-1.5 hover:bg-white/5 rounded text-slate-400 hover:text-white transition-colors"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => copyToClipboard(block.code, block.id)}
                            className="p-1.5 hover:bg-white/5 rounded text-slate-400 hover:text-white transition-colors"
                            title="Copy"
                          >
                            {copiedId === block.id ? <Check className="w-4 h-4 text-green-400" /> : <Clipboard className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="max-h-[300px] overflow-auto custom-scrollbar">
                        <SyntaxHighlighter
                          language={block.type}
                          style={atomDark}
                          customStyle={{ margin: 0, padding: '1.5rem', background: 'transparent', fontSize: '13px' }}
                        >
                          {block.code}
                        </SyntaxHighlighter>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4 py-20">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
                      <AlertCircle className="w-8 h-8 opacity-20" />
                    </div>
                    <p className="text-center max-w-[250px] leading-relaxed italic opacity-50">
                      No code blocks found yet. Paste some text and hit extract.
                    </p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>

      {/* Footer info */}
      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-white/5 mt-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 opacity-40 grayscale hover:grayscale-0 transition-all duration-500">
           <div className="text-sm">Built for fast TSX extraction from mixed documents</div>
           <div className="flex gap-4 text-xs">
             <span>Regex Engine v1.0</span>
             <span>•</span>
             <span>AST Support Coming Soon</span>
           </div>
        </div>
      </footer>
    </div>
  );
};

export default App;

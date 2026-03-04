import React, { useState, useEffect, useCallback } from 'react';
import {
  Code2,
  Clipboard,
  Check,
  Trash2,
  FileCode,
  AlertCircle,
  Sparkles,
  Search,
  Download,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Film,
  Zap,
  RefreshCw
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

type WorkflowStatus = 'idle' | 'triggering' | 'queued' | 'in_progress' | 'completed' | 'failed';

const GITHUB_OWNER = 'kunnuEra';
const GITHUB_REPO = 'tsx-code-to-mp4-kux-automation-';

export const App: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [extractedBlocks, setExtractedBlocks] = useState<ExtractedBlock[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // GitHub Actions state
  const [githubToken, setGithubToken] = useState<string>(localStorage.getItem('gh_token') || '');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus>('idle');
  const [workflowRunId, setWorkflowRunId] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [artifactUrl, setArtifactUrl] = useState<string | null>(null);
  const [artifactDownloadUrl, setArtifactDownloadUrl] = useState<string | null>(null);

  // Save token to localStorage
  const saveToken = (token: string) => {
    setGithubToken(token);
    localStorage.setItem('gh_token', token);
    setShowTokenInput(false);
  };

  const extractCode = () => {
    setIsProcessing(true);
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

    // Pattern 2: Heuristic fallback
    if (blocks.length === 0) {
      if (inputText.includes('import') || (inputText.includes('<') && inputText.includes('/>'))) {
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
    setWorkflowStatus('idle');
    setWorkflowRunId(null);
    setArtifactUrl(null);
    setArtifactDownloadUrl(null);
    setStatusMessage('');
  };

  // ─── GitHub Actions Integration ───

  async function githubAPI(method: string, path: string, body?: any) {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 204) return null;
    return res.json();
  }

  async function updateInputFile(content: string) {
    // Get current file SHA
    const fileData = await githubAPI('GET', '/contents/tsx%20logic/automation/input.txt');
    const sha = fileData?.sha;

    // Build markdown-wrapped content from extracted blocks
    let inputContent = '';
    extractedBlocks.forEach((block, i) => {
      inputContent += '```' + block.type + '\n' + block.code + '\n```\n\n';
    });

    const body: any = {
      message: 'update: input codes for bulk render',
      content: btoa(unescape(encodeURIComponent(inputContent))),
      branch: 'main'
    };
    if (sha) body.sha = sha;

    return githubAPI('PUT', '/contents/tsx%20logic/automation/input.txt', body);
  }

  async function triggerWorkflow() {
    return githubAPI('POST', '/actions/workflows/playwright.yml/dispatches', {
      ref: 'main'
    });
  }

  async function getLatestWorkflowRun(): Promise<any> {
    const data = await githubAPI('GET', '/actions/runs?per_page=1&branch=main');
    return data?.workflow_runs?.[0];
  }

  async function getArtifacts(runId: number): Promise<any> {
    const data = await githubAPI('GET', `/actions/runs/${runId}/artifacts`);
    return data?.artifacts || [];
  }

  // ─── Bulk Render Flow ───

  const startBulkRender = async () => {
    if (!githubToken) {
      setShowTokenInput(true);
      return;
    }

    if (extractedBlocks.length === 0) {
      setStatusMessage('No TSX blocks to render!');
      return;
    }

    try {
      // Step 1: Update input.txt on GitHub
      setWorkflowStatus('triggering');
      setStatusMessage('Uploading TSX codes to GitHub...');

      await updateInputFile(inputText);

      // Step 2: Trigger workflow
      setStatusMessage('Triggering GitHub Actions workflow...');
      await triggerWorkflow();

      // Step 3: Wait a bit, then find the run
      setWorkflowStatus('queued');
      setStatusMessage('Workflow queued! Waiting for it to start...');

      // Poll for the workflow run
      await new Promise(r => setTimeout(r, 5000));

      const run = await getLatestWorkflowRun();
      if (run) {
        setWorkflowRunId(run.id);
        setWorkflowStatus('in_progress');
        setStatusMessage(`Workflow running... (Run #${run.run_number})`);
      }

    } catch (err: any) {
      setWorkflowStatus('failed');
      setStatusMessage('Error: ' + (err.message || 'Unknown error'));
    }
  };

  // Poll workflow status
  const pollWorkflowStatus = useCallback(async () => {
    if (!workflowRunId || !githubToken) return;

    try {
      const run = await githubAPI('GET', `/actions/runs/${workflowRunId}`);

      if (run?.status === 'completed') {
        if (run.conclusion === 'success') {
          setWorkflowStatus('completed');
          setStatusMessage('Videos generated successfully! 🎉');

          // Get artifacts
          const artifacts = await getArtifacts(workflowRunId);
          if (artifacts.length > 0) {
            setArtifactUrl(`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runs/${workflowRunId}`);
            setArtifactDownloadUrl(artifacts[0].archive_download_url);
          }
        } else {
          setWorkflowStatus('failed');
          setStatusMessage(`Workflow ${run.conclusion}. Check GitHub for details.`);
          setArtifactUrl(`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runs/${workflowRunId}`);
        }
      } else if (run?.status === 'in_progress' || run?.status === 'queued') {
        setWorkflowStatus(run.status === 'queued' ? 'queued' : 'in_progress');
        setStatusMessage(`Workflow ${run.status}...`);
      }
    } catch (err) {
      console.error('Poll error:', err);
    }
  }, [workflowRunId, githubToken]);

  useEffect(() => {
    if (workflowStatus === 'in_progress' || workflowStatus === 'queued') {
      const interval = setInterval(pollWorkflowStatus, 10000); // Poll every 10s
      return () => clearInterval(interval);
    }
  }, [workflowStatus, pollWorkflowStatus]);

  const downloadArtifact = async () => {
    if (artifactDownloadUrl && githubToken) {
      // GitHub API redirects to a download URL
      const res = await fetch(artifactDownloadUrl, {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github+json',
        },
        redirect: 'follow',
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'generated-videos.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } else if (artifactUrl) {
      window.open(artifactUrl, '_blank');
    }
  };

  // Status badge styling
  const getStatusColor = () => {
    switch (workflowStatus) {
      case 'triggering': return 'text-yellow-400';
      case 'queued': return 'text-orange-400';
      case 'in_progress': return 'text-cyan-400';
      case 'completed': return 'text-green-400';
      case 'failed': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  const getStatusIcon = () => {
    switch (workflowStatus) {
      case 'triggering':
      case 'queued':
      case 'in_progress':
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'failed':
        return <XCircle className="w-4 h-4" />;
      default:
        return null;
    }
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
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowTokenInput(!showTokenInput)}
              className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-cyan-500/30 text-slate-400 hover:text-white transition-all"
            >
              {githubToken ? '🔑 Token Set' : '⚙️ Set Token'}
            </button>
          </div>
        </div>
      </nav>

      {/* Token Input Modal */}
      <AnimatePresence>
        {showTokenInput && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            onClick={() => setShowTokenInput(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#121214] border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl"
            >
              <h3 className="text-lg font-bold mb-2">GitHub Personal Access Token</h3>
              <p className="text-sm text-slate-400 mb-6">
                Required to trigger workflows and download videos. Token is stored locally in your browser only.
              </p>
              <input
                type="password"
                placeholder="ghp_xxxxxxxxxxxx or github_pat_xxxx"
                defaultValue={githubToken}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-cyan-500/50 mb-4"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveToken((e.target as HTMLInputElement).value);
                }}
                id="token-input"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const input = document.getElementById('token-input') as HTMLInputElement;
                    saveToken(input.value);
                  }}
                  className="flex-1 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl font-semibold text-sm text-white"
                >
                  Save Token
                </button>
                <button
                  onClick={() => setShowTokenInput(false)}
                  className="px-6 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-400"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                className="relative w-full h-[500px] bg-[#121214] border border-white/10 rounded-2xl p-6 text-sm font-mono focus:outline-none focus:border-cyan-500/50 transition-all resize-none placeholder:text-slate-600 shadow-2xl"
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
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-blue-500 flex items-center gap-2">
                <FileCode className="w-4 h-4" />
                Extracted Results
                {extractedBlocks.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-[10px] font-bold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    {extractedBlocks.length} found
                  </span>
                )}
              </h2>
            </div>

            <div className="space-y-4 min-h-[400px] max-h-[500px] overflow-y-auto rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 custom-scrollbar">
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
                      <div className="max-h-[200px] overflow-auto custom-scrollbar">
                        <SyntaxHighlighter
                          language={block.type}
                          style={atomDark}
                          customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '12px' }}
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

            {/* ─── BULK RENDER 4K SECTION ─── */}
            {extractedBlocks.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Bulk Render Button */}
                <button
                  onClick={startBulkRender}
                  disabled={workflowStatus === 'triggering' || workflowStatus === 'in_progress' || workflowStatus === 'queued'}
                  className="w-full py-4 bg-gradient-to-r from-purple-600 via-pink-600 to-red-500 hover:from-purple-500 hover:via-pink-500 hover:to-red-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-white shadow-xl shadow-pink-900/30 transition-all active:scale-[0.98] flex items-center justify-center gap-3 relative overflow-hidden group"
                >
                  {/* Animated bg shimmer */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />

                  {(workflowStatus === 'triggering' || workflowStatus === 'in_progress' || workflowStatus === 'queued') ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Film className="w-5 h-5" />
                      <Zap className="w-4 h-4" />
                      Bulk Render {extractedBlocks.length} Video{extractedBlocks.length > 1 ? 's' : ''} in 4K
                    </>
                  )}
                </button>

                {/* Status Panel */}
                {workflowStatus !== 'idle' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className={`rounded-xl border p-4 ${workflowStatus === 'completed'
                        ? 'border-green-500/20 bg-green-500/5'
                        : workflowStatus === 'failed'
                          ? 'border-red-500/20 bg-red-500/5'
                          : 'border-cyan-500/20 bg-cyan-500/5'
                      }`}
                  >
                    <div className={`flex items-center gap-2 text-sm font-medium ${getStatusColor()}`}>
                      {getStatusIcon()}
                      {statusMessage}
                    </div>

                    {/* Refresh button */}
                    {(workflowStatus === 'in_progress' || workflowStatus === 'queued') && (
                      <button
                        onClick={pollWorkflowStatus}
                        className="mt-3 text-xs flex items-center gap-1 text-slate-400 hover:text-cyan-400 transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" /> Check status now
                      </button>
                    )}

                    {/* Download / View Results */}
                    {workflowStatus === 'completed' && (
                      <div className="mt-4 flex gap-3">
                        <button
                          onClick={downloadArtifact}
                          className="flex-1 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all"
                        >
                          <Download className="w-4 h-4" />
                          Download Videos (ZIP)
                        </button>
                        {artifactUrl && (
                          <a
                            href={artifactUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-300 hover:text-white transition-colors flex items-center gap-2"
                          >
                            <Play className="w-4 h-4" />
                            View on GitHub
                          </a>
                        )}
                      </div>
                    )}

                    {/* Failed - retry */}
                    {workflowStatus === 'failed' && (
                      <div className="mt-4 flex gap-3">
                        <button
                          onClick={startBulkRender}
                          className="flex-1 py-2.5 bg-gradient-to-r from-red-600 to-orange-600 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Retry
                        </button>
                        {artifactUrl && (
                          <a
                            href={artifactUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-400 flex items-center gap-2"
                          >
                            View Logs
                          </a>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-white/5 mt-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 opacity-40 grayscale hover:grayscale-0 transition-all duration-500">
          <div className="text-sm">TSX Extractor + Bulk 4K Video Renderer</div>
          <div className="flex gap-4 text-xs">
            <span>Powered by GitHub Actions</span>
            <span>•</span>
            <span>Playwright Automation</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;

import React, { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { X, Download, Copy, Check, ExternalLink, QrCode } from 'lucide-react';
import { buildShortUrl } from '../lib/urlUtils';
import { LinkItem } from '../types';

interface QrCodeModalProps {
  link: LinkItem | null;
  onClose: () => void;
}

export const QrCodeModal: React.FC<QrCodeModalProps> = ({ link, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [qrSize, setQrSize] = useState<number>(240);
  const [fgColor, setFgColor] = useState<string>('#0f172a');
  const canvasRef = useRef<HTMLDivElement>(null);

  if (!link) return null;

  const fullShortUrl = buildShortUrl(link.shortCode);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullShortUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current.querySelector('canvas');
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = dataUrl;
    downloadAnchor.download = `qrcode-${link.shortCode}.png`;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
  };

  return (
    <div
      id="qr-code-modal-backdrop"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="min-h-full flex items-center justify-center p-4 text-left"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          id="qr-code-modal-container"
          className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-7 overflow-hidden text-slate-900 dark:text-slate-100 animate-scale-in my-8"
        >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg leading-tight">QR Code</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-[240px] truncate">
                {link.title || link.shortCode}
              </p>
            </div>
          </div>
          <button
            id="close-qr-modal-btn"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QR Code Canvas Display */}
        <div className="my-6 flex flex-col items-center justify-center">
          <div
            ref={canvasRef}
            className="p-3 sm:p-5 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-center aspect-square"
          >
            <QRCodeCanvas
              value={fullShortUrl}
              size={qrSize} // Actual resolution for download
              fgColor={fgColor}
              bgColor="#ffffff"
              level="H"
              includeMargin={true}
              style={{ width: '220px', height: '220px' }} // Fixed visual display size
            />
          </div>
          <p className="mt-3 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 text-center px-2 break-all">
            Points to: <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{fullShortUrl}</span>
          </p>
        </div>

        {/* QR Customization quick options */}
        <div className="mb-6 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400 font-medium shrink-0">Color:</span>
            <div className="flex gap-1.5 shrink-0">
              {[
                { label: 'Slate', color: '#0f172a' },
                { label: 'Indigo', color: '#4338ca' },
                { label: 'Emerald', color: '#047857' },
                { label: 'Rose', color: '#be123c' },
              ].map((c) => (
                <button
                  key={c.color}
                  type="button"
                  onClick={() => setFgColor(c.color)}
                  className={`w-6 h-6 sm:w-5 sm:h-5 rounded-full border cursor-pointer transition-transform hover:scale-110 shrink-0 ${
                    fgColor === c.color ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-slate-100' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c.color }}
                  title={c.label}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-slate-500 dark:text-slate-400 font-medium shrink-0">Size:</span>
            <select
              value={qrSize}
              onChange={(e) => setQrSize(Number(e.target.value))}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5 sm:py-1 text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none shrink-0"
            >
              <option value={180}>Small (180px)</option>
              <option value={240}>Medium (240px)</option>
              <option value={320}>Large (320px)</option>
              <option value={512}>X-Large (512px)</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            id="download-qr-btn"
            onClick={handleDownload}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-medium text-sm transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Download PNG
          </button>

          <button
            id="copy-short-url-btn"
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium text-sm transition-all active:scale-95 cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>

        {/* Open short link in new tab */}
        <div className="mt-3 text-center">
          <a
            href={fullShortUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:underline pt-1"
          >
            Test link in new tab <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
      </div>
    </div>
  );
};

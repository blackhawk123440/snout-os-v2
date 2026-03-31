"use client";

import { useState } from "react";

// Original tipping system colors
const TIP_COLORS = {
  pink: '#FCE1EF',
  light: '#FEECF4',
  brown: '#442F21',
};

export default function TipLinkBuilderPage() {
  const [amount, setAmount] = useState("");
  const [alias, setAlias] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");

  const handleGenerate = () => {
    const amt = String(amount || '').trim().replace(',', '.');
    const sitterAlias = String(alias || '').trim() || 'snout-services';
    
    if (!amt) {
      alert('Enter an amount, e.g., 75.00');
      return;
    }

    const baseDomain = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const url = `${baseDomain}/tip/t/${encodeURIComponent(amt)}/${encodeURIComponent(sitterAlias)}`;
    setGeneratedLink(url);
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ background: '#fff', color: TIP_COLORS.brown, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="max-w-[520px] w-full">
        <div className="p-4 rounded-xl shadow-sm" style={{ background: TIP_COLORS.pink, boxShadow: '0 4px 12px rgba(0,0,0,.08)' }}>
          <img
            className="max-w-[140px] block mx-auto mb-3"
            src="https://cdn.prod.website-files.com/678d913121365c19cdb8f056/68cb09476e07dfaa65364776_59fdb9b7-cf81-4f59-94e5-d109ed1d96c9.png"
            alt="Snout Services"
          />
          <h2 className="text-xl font-semibold text-center mb-4" style={{ color: TIP_COLORS.brown }}>
            Link Builder
          </h2>
          
          <label className="block mb-2 text-sm" style={{ color: TIP_COLORS.brown }}>
            Service Amount (e.g., 120.50)
          </label>
          <input
            id="amt"
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="75.00"
            className="w-full px-3 py-2 mb-4 border rounded-lg"
            style={{
              borderColor: '#d1d1d1',
              minHeight: '44px',
            }}
          />
          
          <label className="block mb-2 text-sm" style={{ color: TIP_COLORS.brown }}>
            Sitter (alias or acct_...)
          </label>
          <input
            id="alias"
            type="text"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="s1"
            className="w-full px-3 py-2 mb-4 border rounded-lg"
            style={{
              borderColor: '#d1d1d1',
              minHeight: '44px',
            }}
          />
          
          <button
            id="go"
            onClick={handleGenerate}
            className="w-full py-3 rounded-lg font-semibold transition-all"
            style={{
              background: TIP_COLORS.brown,
              color: '#fff',
              minHeight: '44px',
            }}
          >
            Create Link
          </button>
          
          {generatedLink && (
            <div className="mt-4 p-3 rounded-lg break-all text-sm" style={{ background: '#fff' }}>
              <strong>Link:</strong>{' '}
              <a
                href={generatedLink}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                style={{ color: TIP_COLORS.brown }}
              >
                {generatedLink}
              </a>
            </div>
          )}
          
          <div className="mt-4 text-xs text-center" style={{ color: TIP_COLORS.brown, opacity: 0.7 }}>
            Tip: share the short link via OpenPhone. The page reads the amount and calculates 10, 15, 20, 25 percent plus custom.
          </div>
        </div>
      </div>
    </div>
  );
}


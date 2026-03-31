"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Script from "next/script";

// Original tipping system colors
const TIP_COLORS = {
  pink: '#FCE1EF',
  light: '#FEECF4',
  brown: '#442F21',
};

declare global {
  interface Window {
    Stripe: any;
  }
}

function TipPaymentContent() {
  const searchParams = useSearchParams();
  const service = parseFloat(searchParams.get('service') || '50.00');
  const sitterId = searchParams.get('sitter_id') || 'unknown';
  const sitterAlias = searchParams.get('sitter_alias') || sitterId; // Use alias if provided, fallback to sitterId
  
  const [stripe, setStripe] = useState<any>(null);
  const [elements, setElements] = useState<any>(null);
  const [card, setCard] = useState<any>(null);
  const [selectedTip, setSelectedTip] = useState(0);
  const [customTip, setCustomTip] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [payerName, setPayerName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sitterName, setSitterName] = useState<string | null>(null);

  // Fetch sitter name using the alias (more reliable than sitter_id which might be Stripe account ID)
  useEffect(() => {
    const lookupId = sitterAlias || sitterId;
    if (lookupId && lookupId !== 'unknown') {
      fetch(`/api/tip/sitter-info?sitter_id=${encodeURIComponent(lookupId)}`)
        .then(r => r.json())
        .then(data => {
          if (data.name) {
            setSitterName(data.name);
          }
        })
        .catch(() => {
          setSitterName(null);
        });
    }
  }, [sitterAlias, sitterId]);

  useEffect(() => {
    // Initialize Stripe
    if (window.Stripe) {
      fetch('/api/tip/config')
        .then(r => r.json())
        .then(cfg => {
          if (!cfg.publishableKey) {
            setError('Missing publishable key. Set STRIPE_PUBLISHABLE_KEY in environment.');
            return;
          }
          const stripeInstance = window.Stripe(cfg.publishableKey);
          const elementsInstance = stripeInstance.elements({
            fonts: [{
              cssSrc: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap'
            }]
          });
          const cardElement = elementsInstance.create('card', {
            style: {
              base: {
                fontFamily: 'Inter, sans-serif',
                fontSize: '16px',
                color: TIP_COLORS.brown,
                '::placeholder': { color: '#7a5f4a' }
              },
              invalid: { color: '#d32f2f' }
            }
          });
          cardElement.mount('#card-element');
          setStripe(stripeInstance);
          setElements(elementsInstance);
          setCard(cardElement);
        })
        .catch(() => {
          setError('Failed to initialize Stripe');
        });
    }
  }, []);

  const tipOptions = [
    { percent: 10, amount: service * 0.10 },
    { percent: 15, amount: service * 0.15 },
    { percent: 20, amount: service * 0.20 },
    { percent: 25, amount: service * 0.25 },
  ];

  const handleTipSelect = (percent: number) => {
    setSelectedTip(service * percent / 100);
    setCustomTip("");
    setShowCustom(false);
    setError("");
  };

  const handleCustomTipChange = (value: string) => {
    setCustomTip(value);
    const v = parseFloat(value);
    setSelectedTip(isNaN(v) ? 0 : v);
    setShowCustom(true);
    setError("");
  };

  const handlePayment = async () => {
    if (selectedTip <= 0) {
      setError('Please choose or enter a tip amount.');
      return;
    }

    setLoading(true);
    setError("");

    const cents = Math.round(selectedTip * 100);
    const idem = String(Date.now()) + '-' + Math.random().toString(36).slice(2);

    try {
      const resp = await fetch('/api/tip/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idem,
        },
        body: JSON.stringify({
          amount: cents,
          currency: 'usd',
          metadata: {
            tip_amount: selectedTip.toFixed(2),
            sitter_id: sitterId,
            payer_name: payerName,
          },
        }),
      });

      const data = await resp.json();
      if (data.error) {
        setError(data.error.message);
        setLoading(false);
        return;
      }

      const result = await stripe.confirmCardPayment(data.clientSecret, {
        payment_method: {
          card,
          billing_details: { name: payerName },
        },
      });

      if (result.error) {
        setError(result.error.message);
        setLoading(false);
      } else {
        window.location.href = `/tip/success?payment_intent=${result.paymentIntent.id}&sitter_id=${encodeURIComponent(sitterId)}&service=${service.toFixed(2)}&tip=${selectedTip.toFixed(2)}`;
      }
    } catch (err: any) {
      setError(err.message || 'Payment failed');
      setLoading(false);
    }
  };

  return (
    <>
      <Script src="https://js.stripe.com/v3/" strategy="beforeInteractive" />
      <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ background: '#fff', color: TIP_COLORS.brown, fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div className="max-w-[520px] w-full">
          <div className="p-4 rounded-xl shadow-sm" style={{ background: TIP_COLORS.pink, boxShadow: '0 4px 12px rgba(0,0,0,.08)' }}>
            <img
              className="max-w-[140px] block mx-auto mb-3"
              src="https://cdn.prod.website-files.com/678d913121365c19cdb8f056/68cb09476e07dfaa65364776_59fdb9b7-cf81-4f59-94e5-d109ed1d96c9.png"
              alt="Snout Services"
            />
            <h2 className="text-xl font-semibold text-center mb-3" style={{ color: TIP_COLORS.brown }}>
              Thank Your Sitter
            </h2>
            <p className="text-xs text-center mb-4" style={{ color: TIP_COLORS.brown }}>
              {sitterName 
                ? `${sitterName} receives 100% of your tip` 
                : sitterAlias && sitterAlias !== 'unknown' && sitterAlias !== sitterId
                  ? `${sitterAlias.split('-').map((n: string) => n.charAt(0).toUpperCase() + n.slice(1)).join(' ')} receives 100% of your tip`
                  : 'Sitters receive 100% of your tip'
              }
            </p>

            {/* Tip Options */}
            <div className="mb-4">
              <div className="text-lg font-semibold mb-3" style={{ color: TIP_COLORS.brown }}>
                Choose a tip
              </div>
              <div className="grid grid-cols-2 gap-2">
                {tipOptions.map((opt) => (
                  <button
                    key={opt.percent}
                    onClick={() => handleTipSelect(opt.percent)}
                    className={`p-3 rounded-lg border text-center cursor-pointer transition-all ${
                      selectedTip === opt.amount && !showCustom
                        ? 'bg-opacity-100'
                        : 'bg-white border-opacity-50'
                    }`}
                    style={{
                      background: selectedTip === opt.amount && !showCustom ? TIP_COLORS.brown : 'white',
                      color: selectedTip === opt.amount && !showCustom ? '#fff' : TIP_COLORS.brown,
                      borderColor: selectedTip === opt.amount && !showCustom ? TIP_COLORS.brown : '#d1d1d1',
                    }}
                  >
                    <div className="font-semibold">{opt.percent}%</div>
                    <div className="text-xs">(${opt.amount.toFixed(2)})</div>
                  </button>
                ))}
                <button
                  onClick={() => {
                    setShowCustom(true);
                    setSelectedTip(0);
                    setCustomTip("");
                  }}
                  className={`p-3 rounded-lg border text-center cursor-pointer bg-white col-span-2 ${
                    showCustom ? 'border-opacity-100' : 'border-opacity-50'
                  }`}
                  style={{
                    borderColor: showCustom ? TIP_COLORS.brown : '#d1d1d1',
                    color: TIP_COLORS.brown,
                  }}
                >
                  Custom
                </button>
              </div>
              {showCustom && (
                <input
                  id="custom-tip"
                  type="number"
                  min="0"
                  step="0.01"
                  value={customTip}
                  onChange={(e) => handleCustomTipChange(e.target.value)}
                  placeholder="Enter custom tip ($)"
                  className="w-full mt-2 px-3 py-2 border rounded-lg"
                  style={{
                    borderColor: '#d1d1d1',
                    color: TIP_COLORS.brown,
                    minHeight: '48px',
                    fontSize: '16px',
                  }}
                />
              )}
            </div>

            {/* Total */}
            <div className="mb-4 text-lg font-semibold" style={{ color: TIP_COLORS.brown }}>
              Total tip <span>${selectedTip.toFixed(2)}</span>
            </div>

            {/* Name Input */}
            <input
              id="payer-name"
              type="text"
              value={payerName}
              onChange={(e) => setPayerName(e.target.value)}
              placeholder="First and last name"
              className="w-full mb-4 px-3 py-2 border rounded-lg"
              style={{
                borderColor: '#d1d1d1',
                color: TIP_COLORS.brown,
                minHeight: '48px',
                fontSize: '16px',
              }}
            />

            {/* Card Element */}
            <div
              id="card-element"
              className="mb-4 px-3 py-2 border rounded-lg"
              style={{
                borderColor: '#d1d1d1',
                minHeight: '48px',
                background: '#fff',
              }}
            />

            {/* Error */}
            {error && (
              <div className="mb-4 text-sm" style={{ color: '#d32f2f' }}>
                {error}
              </div>
            )}

            {/* Pay Button */}
            <button
              id="pay"
              onClick={handlePayment}
              disabled={loading || selectedTip <= 0}
              className="w-full py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-300"
              style={{
                background: loading || selectedTip <= 0 ? '#d1d1d1' : TIP_COLORS.brown,
                color: '#fff',
                minHeight: '48px',
                fontSize: '16px',
              }}
            >
              {loading ? 'Processing...' : 'Pay Tip'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function TipPaymentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <TipPaymentContent />
    </Suspense>
  );
}


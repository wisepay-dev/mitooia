"use client";

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Copy, QrCode, Clock, RefreshCw } from 'lucide-react';
import styles from './checkout.module.css';
import { useFunnelSession } from '../../hooks/useFunnelSession';

export default function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const { trackEvent, funnelData } = useFunnelSession();
  
  const [order, setOrder] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [reconciling, setReconciling] = useState(false);

  useEffect(() => {
    trackEvent('checkout_viewed', { orderId: id });

    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/order/${id}`);
        if (!res.ok) {
          setError('Pedido não encontrado');
          setLoading(false);
          return;
        }
        const data = await res.json();
        setOrder(data);
        setLoading(false);

        if (data.status === 'APPROVED') {
          trackEvent('payment_approved', { orderId: id });
        }
      } catch (e) {
        setError('Erro de conexão');
        setLoading(false);
      }
    };

    fetchStatus();

    // Polling
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/order/${id}`);
        if (res.ok) {
          const data = await res.json();
          setOrder(data);
          if (data.status === 'APPROVED') {
            clearInterval(interval);
            trackEvent('payment_approved', { orderId: id });
          }
        }
      } catch (e) {
        // ignore polling errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [id, trackEvent]);

  const copyToClipboard = () => {
    const pixCopyPaste = order?.pixCopyPaste || funnelData?.pixCopyPaste;
    if (!pixCopyPaste || pixCopyPaste.length === 0) return;
    
    navigator.clipboard.writeText(pixCopyPaste).then(() => {
      setCopied(true);
      trackEvent('pix_copied', { orderId: id });
      setTimeout(() => setCopied(false), 3000);
    }).catch(() => {
      alert("Não foi possível copiar. Tente novamente.");
    });
  };

  const handleGenerate = async () => {
    if (generating) return; // Prevent double click
    setGenerating(true);
    trackEvent('generation_started', { orderId: id });
    
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: id })
      });
      const data = await res.json();
      
      if (data.success) {
        router.push(`/result/${id}`);
      } else {
        alert(data.error || 'Erro na geração');
        setGenerating(false);
      }
    } catch (e) {
      alert('Erro ao comunicar com IA. Tente novamente.');
      setGenerating(false);
    }
  };

  const handleReconcile = async () => {
    if (reconciling) return;
    setReconciling(true);
    
    try {
      const res = await fetch(`/api/order/${id}/reconcile`, {
        method: 'POST'
      });
      const data = await res.json();
      
      if (data.success && data.paid) {
        setOrder({ ...order, status: 'PAID' });
      } else {
        alert("Pagamento ainda não identificado. Aguarde alguns segundos.");
      }
    } catch (e) {
      alert("Erro ao verificar pagamento.");
    } finally {
      setReconciling(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className="spinner" style={{width: 48, height: 48}}></div>
        <p style={{marginTop: 16}}>Carregando pedido...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className={styles.container}>
        <h1 style={{color: 'red'}}>Erro</h1>
        <p>{error}</p>
        <button className="primary-btn" onClick={() => router.push('/')} style={{marginTop: 24, maxWidth: 300}}>
          VOLTAR PARA O INÍCIO
        </button>
      </div>
    );
  }

  // Handle Expired or failed
  if (order.status === 'EXPIRED' || order.status === 'FAILED') {
    return (
      <div className={styles.container}>
        <h1>O PIX expirou.</h1>
        <p style={{color: '#888'}}>Este código não é mais válido.</p>
        <button className="primary-btn" onClick={() => router.push('/create')} style={{marginTop: 24, maxWidth: 300}}>
          GERAR NOVO PIX — R$4,90
        </button>
      </div>
    );
  }

  return (
    <>
      <div className={styles.progressContainer}>
        <div className={`${styles.progressStep} ${styles.progressDone}`}>
          <CheckCircle2 size={14} /> 01 FOTO
        </div>
        <div className={`${styles.progressStep} ${styles.progressDone}`}>
          <CheckCircle2 size={14} /> 02 CENÁRIO
        </div>
        <div className={`${styles.progressStep} ${order.status === 'APPROVED' ? styles.progressDone : styles.progressActive}`}>
          {order.status === 'APPROVED' ? <CheckCircle2 size={14} /> : ''} 03 PAGAMENTO
        </div>
        <div className={`${styles.progressStep} ${order.status === 'APPROVED' ? styles.progressActive : ''}`}>
          04 RESULTADO
        </div>
      </div>

      <div className={styles.main}>
        {order.status !== 'APPROVED' ? (
          <div className={`${styles.card} fade-in`}>
            <div className={styles.header}>
              <h1 className={styles.title}>QUASE LÁ.</h1>
              <p className={styles.subtitle}>Copie o código PIX para liberar sua criação.</p>
              <div className={styles.price}>R$ 4,90</div>
            </div>

            <div className={styles.pixSection}>
              {/* PRIMARY CTA MOBILE: COPIAR PIX */}
              <button 
                className={`primary-btn ${styles.copyBtn} ${copied ? styles.copied : ''}`}
                onClick={copyToClipboard}
              >
                {copied ? (
                  <><CheckCircle2 size={20} /> CÓDIGO COPIADO</>
                ) : (
                  <><Copy size={20} /> COPIAR CÓDIGO PIX</>
                )}
              </button>

              <div className={styles.instructions}>
                <ol>
                  <li>Abra seu aplicativo do banco.</li>
                  <li>Escolha a opção PIX Copia e Cola.</li>
                  <li>Cole o código e confirme o pagamento.</li>
                </ol>
              </div>

              {/* SECONDARY: QR CODE FOR DESKTOP */}
              {(() => {
                const rawQrCode = order?.qrCodeBase64 || funnelData?.qrCodeBase64;
                if (!rawQrCode) return null;
                const qrSrc = rawQrCode.startsWith('data:image/') ? rawQrCode : `data:image/png;base64,${rawQrCode}`;
                
                return (
                  <div className={styles.qrContainerDesktop}>
                    <div className={styles.divider}>
                      <span>ou escaneie o QR Code</span>
                    </div>
                    <img src={qrSrc} alt="QR Code PIX" className={styles.qrCode} />
                  </div>
                );
              })()}
            </div>

            <div className={styles.statusBox}>
              <Clock size={20} className={styles.spinIcon} />
              <div className={styles.statusText}>
                <strong>Aguardando pagamento...</strong>
                <span>Você não precisa recarregar a página.</span>
              </div>
              <button 
                className={styles.secondaryBtn} 
                onClick={handleReconcile}
                disabled={reconciling}
                style={{ marginTop: '12px', fontSize: '0.85rem', padding: '8px 16px', background: 'transparent', border: '1px solid #444', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}
              >
                {reconciling ? 'Verificando pagamento...' : 'Já paguei — verificar agora'}
              </button>
            </div>
            
            <div className={styles.securitySeal}>
              🔒 Pagamento processado com segurança
            </div>
          </div>
        ) : (
          <div className={`${styles.card} ${styles.successCard} fade-in`}>
            <div className={styles.successIcon}>
              <CheckCircle2 size={64} />
            </div>
            <h1 className={styles.title} style={{color: 'var(--accent-green)'}}>PAGAMENTO CONFIRMADO ✓</h1>
            <p className={styles.subtitle}>Tudo certo com o seu pedido.</p>
            
            <div className={styles.divider}></div>
            
            <h2 className={styles.title} style={{fontSize: '1.5rem', marginBottom: '24px'}}>AGORA VAMOS CRIAR SUA FOTO.</h2>
            
            <button className="primary-btn" onClick={handleGenerate} disabled={generating}>
              {generating ? (
                <><div className="spinner" style={{width: 24, height: 24}}></div> INICIANDO IA...</>
              ) : (
                'GERAR MINHA FOTO'
              )}
            </button>
            <p style={{fontSize: '0.8rem', color: '#888', marginTop: '16px'}}>Não saia ou recarregue essa página após clicar.</p>
          </div>
        )}
      </div>
    </>
  );
}

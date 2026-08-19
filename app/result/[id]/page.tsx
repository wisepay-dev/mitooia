"use client";

import { useEffect, useState, use } from 'react';
import { Download, Share2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import styles from './result.module.css';

const LOADING_STEPS = [
  "Preparando sua selfie...",
  "Montando o cenário...",
  "Criando a composição com IA...",
  "Finalizando detalhes..."
];

export default function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Custom Loading states
  const [stepIndex, setStepIndex] = useState(0);
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/status/${id}`);
        const data = await res.json();
        
        if (!data.success) {
          if (data.error === 'ORDER_NOT_FOUND') {
            setError('Pedido não encontrado.');
            setLoading(false);
            clearInterval(interval);
            return;
          }
          if (data.status === 'FAILED') {
            setError('Falha na geração: ' + (data.error || 'Erro desconhecido.'));
            setLoading(false);
            clearInterval(interval);
            return;
          }
        }
        
        setOrder(data);
        
        if (data.status === 'COMPLETED') {
          setLoading(false);
          clearInterval(interval);
          setTimeout(() => setReveal(true), 100);
        } else if (data.status === 'FAILED') {
          setError('Falha na geração: ' + (data.error || 'Erro desconhecido.'));
          setLoading(false);
          clearInterval(interval);
        } else if (data.status === 'PENDING' || data.status === 'PROCESSING') {
          // Keep polling
        }
      } catch (e) {
        setError('Erro de conexão');
        setLoading(false);
        clearInterval(interval);
      }
    };

    fetchStatus();

    // Polling between 1.5s to 2.5s
    interval = setInterval(() => {
      if (loading) {
        fetchStatus();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [id, loading]);

  // Loading Steps logic
  useEffect(() => {
    if (!loading) return;
    const stepInterval = setInterval(() => {
      setStepIndex((prev) => {
        if (prev < LOADING_STEPS.length - 1) return prev + 1;
        return prev;
      });
    }, 2500);
    return () => clearInterval(stepInterval);
  }, [loading]);

  const handleDownload = async () => {
    if (!order?.resultUrl) return;
    try {
      console.log('[TRACKER EVENT]: download_clicked', { orderId: id });
      const res = await fetch(order.resultUrl);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mito-ia-${id}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (e) {
      alert('Erro ao baixar');
    }
  };

  const handleShare = async () => {
    if (!order?.resultUrl) return;
    console.log('[TRACKER EVENT]: share_clicked', { orderId: id });
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Minha foto no MITO.IA',
          text: 'Fiz uma foto temática usando IA! Veja:',
          url: window.location.href, // Sharing the current page or a public link if implemented
        });
      } catch (err) {
        console.error('Erro ao compartilhar', err);
      }
    } else {
      alert('Compartilhamento não suportado neste navegador.');
    }
  };

  if (error) {
    return (
      <div className={styles.container}>
        <h1 style={{color: 'red'}}>Erro</h1>
        <p>{error}</p>
        <button className="secondary-btn" onClick={() => router.push('/')} style={{marginTop: '24px'}}>
          Voltar ao Início
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className="spinner" style={{width: 64, height: 64, marginBottom: '32px'}}></div>
        <h1 className={styles.loadingTitle}>
          {order?.status === 'PENDING' ? 'Preparando sua geração...' : 'Criando sua foto com IA...'}
        </h1>
        
        <div className={styles.stepsList}>
          {LOADING_STEPS.map((step, index) => (
            <div 
              key={index} 
              className={`${styles.stepItem} ${index < stepIndex ? styles.stepDone : ''} ${index === stepIndex ? styles.stepActive : ''} ${index > stepIndex ? styles.stepPending : ''}`}
            >
              {index < stepIndex ? <CheckCircle2 size={20} color="var(--accent-green)" /> : <div className={styles.stepDot}></div>}
              {step}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>FICOU PRONTA. 🤯</h1>
      <p className={styles.subtitle}>Sua criação temática exclusiva.</p>
      
      <div className={`${styles.imageWrapper} ${reveal ? styles.revealed : ''}`}>
        <img src={order.resultUrl} alt="Resultado IA" className={styles.resultImage} />
        <div className={styles.watermark}>GERADO POR IA</div>
      </div>

      <div className={styles.actionGroup}>
        <button className="primary-btn" onClick={handleDownload}>
          <Download size={24} /> BAIXAR FOTO
        </button>
        <button className="secondary-btn" onClick={handleShare} style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}}>
          <Share2 size={20} /> COMPARTILHAR
        </button>
        <button className="secondary-btn" onClick={() => router.push('/')} style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: 'none'}}>
          <RefreshCw size={20} /> CRIAR OUTRA
        </button>
      </div>
    </div>
  );
}

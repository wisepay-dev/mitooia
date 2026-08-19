"use client";

import { useState, Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, CheckCircle2, Image as ImageIcon, RefreshCw, Lock, Sparkles } from 'lucide-react';
import styles from './page.module.css';
import { useFunnelSession } from '../hooks/useFunnelSession';

const SCENARIOS = [
  {
    id: 'selfie',
    title: 'SELFIE TEMÁTICA',
    description: 'Uma composição casual, como uma selfie.',
    image: '/hero_generated_v2.jpg',
  },
  {
    id: 'comicio',
    title: 'COMÍCIO VERDE E AMARELO',
    description: 'Você em uma grande cena temática brasileira.',
    image: '/gallery_gen_1_v2.jpg',
  },
  {
    id: 'poster',
    title: 'PÔSTER CINEMATOGRÁFICO',
    description: 'Uma versão épica com estética de cinema.',
    image: '/gallery_gen_2.jpg',
  }
];

function CreateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const uploadIdFromUrl = searchParams.get('uploadId');
  const { funnelData, updateFunnelData, trackEvent } = useFunnelSession();
  
  const [selectedScenario, setSelectedScenario] = useState<string>(funnelData?.scenarioId || '');
  const [showSummary, setShowSummary] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const uploadId = uploadIdFromUrl || funnelData?.uploadId;

  useEffect(() => {
    trackEvent('scenario_viewed', { uploadId: uploadIdFromUrl });
    if (!uploadIdFromUrl && !funnelData?.uploadId) {
      console.warn('No uploadId found. Redirecting to home.');
      router.push('/');
    } else if (uploadIdFromUrl && uploadIdFromUrl !== funnelData?.uploadId) {
      updateFunnelData({ uploadId: uploadIdFromUrl });
    }
  }, [uploadIdFromUrl, funnelData?.uploadId, router, trackEvent, updateFunnelData]);

  const handleScenarioClick = (id: string) => {
    setSelectedScenario(id);
    updateFunnelData({ scenarioId: id });
    trackEvent('scenario_selected', { scenarioId: id });
  };

  const handleShowSummary = () => {
    setShowSummary(true);
    trackEvent('checkout_viewed'); // Since the summary acts as the intent to checkout
  };

  const handleCheckout = async () => {
    const uploadId = uploadIdFromUrl || funnelData?.uploadId;
    if (!selectedScenario || !uploadId) return;
    setLoading(true);
    trackEvent('checkout_started', { scenarioId: selectedScenario });

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId: uploadId,
          scenarioId: selectedScenario,
          utms: funnelData?.utms // Persist UTMs to DB
        })
      });
      const data = await res.json();
      
      if (data.orderId) {
        updateFunnelData({ orderId: data.orderId });
        trackEvent('pix_created', { orderId: data.orderId });
        router.push(`/checkout/${data.orderId}`);
      } else {
        alert(data.error || 'Erro ao gerar pagamento');
        setLoading(false);
      }
    } catch (e) {
      console.error(e);
      alert('Erro ao processar');
      setLoading(false);
    }
  };

  const handleReset = () => {
    router.push('/');
  };

  const selectedData = SCENARIOS.find(s => s.id === selectedScenario);

  return (
    <>
      <div className={styles.progressContainer}>
        <div className={`${styles.progressStep} ${styles.progressDone}`}>
          <CheckCircle2 size={14} /> 01 FOTO
        </div>
        <div className={`${styles.progressStep} ${showSummary ? styles.progressDone : styles.progressActive}`}>
          {showSummary ? <CheckCircle2 size={14} /> : ''} 02 CENÁRIO
        </div>
        <div className={`${styles.progressStep} ${showSummary ? styles.progressActive : ''}`}>
          03 PAGAMENTO
        </div>
        <div className={styles.progressStep}>04 RESULTADO</div>
      </div>

      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <div className={styles.photoThumb}>
             <ImageIcon size={16} />
          </div>
          <div>
            <div className={styles.topBarTitle}>[SUA FOTO]</div>
            <div className={styles.topBarStatus}><CheckCircle2 size={12} /> Foto pronta</div>
          </div>
        </div>
        <button className={styles.topBarReset} onClick={handleReset}>
          <RefreshCw size={14} /> TROCAR
        </button>
      </div>

      <main className={styles.main}>
        {!showSummary ? (
          <>
            <h1 className={styles.title}>ESCOLHA SEU CENÁRIO.</h1>
            <p className={styles.subtitle}>Onde você quer aparecer?</p>
            
            <div className={styles.grid}>
              {SCENARIOS.map((scenario) => {
                const isSelected = selectedScenario === scenario.id;
                return (
                  <div 
                    key={scenario.id} 
                    className={`${styles.catalogCard} ${isSelected ? styles.selected : ''}`}
                    onClick={() => handleScenarioClick(scenario.id)}
                  >
                    <div className={styles.imageWrapper}>
                      <img src={scenario.image} alt={scenario.title} className={styles.catalogImage} />
                      <div className={styles.catalogOverlay}>
                        <div className="badge" style={{marginBottom: '4px'}}>GERADO POR IA</div>
                      </div>
                    </div>
                    
                    <div className={styles.cardContent}>
                      <h3 className={styles.catalogName}>{scenario.title}</h3>
                      <p className={styles.catalogDesc}>{scenario.description}</p>
                      
                      <div className={`${styles.selectionIndicator} ${isSelected ? styles.selectionActive : ''}`}>
                        {isSelected ? <><CheckCircle2 size={16} /> SELECIONADO</> : 'ESCOLHER →'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={`${styles.continueContainer} ${selectedScenario ? styles.visible : ''}`}>
              <button className={`primary-btn ${styles.continueBtn}`} onClick={handleShowSummary}>
                CONTINUAR — R$4,90 <ArrowRight size={20} />
              </button>
            </div>
          </>
        ) : (
          <div className={`${styles.summaryContainer} fade-in`}>
            <button className={styles.backBtn} onClick={() => setShowSummary(false)}>
              ← Voltar para cenários
            </button>
            
            <h1 className={styles.summaryTitle}>TUDO PRONTO.</h1>
            <p className={styles.summarySubtitle}>Confirme as informações antes de gerar o PIX.</p>
            
            <div className={styles.summaryBox}>
              <div className={styles.summaryRow}>
                <div className={styles.summaryItem}>
                  <div className={styles.summaryThumb} style={{background: '#333', position: 'relative', overflow: 'hidden'}}>
                    {!previewError && uploadId ? (
                      <>
                        {previewLoading && (
                          <div className="skeleton" style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: '#444', animation: 'pulse 1.5s infinite'}} />
                        )}
                        <img 
                          src={`/api/uploads/${uploadId}/preview`} 
                          style={{width: '100%', height: '100%', objectFit: 'cover', display: previewLoading ? 'none' : 'block'}}
                          alt="Sua foto"
                          onLoad={() => setPreviewLoading(false)}
                          onError={() => {
                            setPreviewLoading(false);
                            setPreviewError(true);
                          }}
                        />
                      </>
                    ) : (
                      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%'}}>
                        <ImageIcon size={24} color="#888" />
                      </div>
                    )}
                  </div>
                  <div style={{flex: 1}}>
                    <div className={styles.summaryLabel}>SUA FOTO</div>
                    {previewError ? (
                      <div style={{fontSize: '0.8rem', color: '#ff4d4f', marginTop: '4px'}}>
                        Não conseguimos carregar a prévia.
                        <button onClick={handleReset} style={{display: 'block', background: 'none', border: 'none', color: 'var(--accent-green)', textDecoration: 'underline', padding: 0, marginTop: '4px', cursor: 'pointer', fontSize: '0.75rem'}}>
                          TROCAR FOTO
                        </button>
                      </div>
                    ) : (
                      <div className={styles.summaryValue}>Upload ✓</div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className={styles.summaryRow}>
                <div className={styles.summaryItem}>
                  <img src={selectedData?.image} className={styles.summaryThumb} alt="Cenário" />
                  <div>
                    <div className={styles.summaryLabel}>SEU CENÁRIO</div>
                    <div className={styles.summaryValue}>{selectedData?.title}</div>
                  </div>
                </div>
              </div>
              
              <div className={styles.summaryDivider}></div>
              
              <div className={styles.summaryTotalRow}>
                <div>1 criação digital</div>
                <div className={styles.summaryTotal}>R$ 4,90</div>
              </div>
              <div style={{fontSize: '0.8rem', color: '#888', textAlign: 'right'}}>Pagamento único.</div>
            </div>

            <button className="primary-btn" onClick={handleCheckout} disabled={loading} style={{marginTop: '24px'}}>
              {loading ? (
                <><div className="spinner" style={{width: 20, height: 20}}></div> GERANDO PIX...</>
              ) : (
                <>PAGAR R$ 4,90 COM PIX <ArrowRight size={20} /></>
              )}
            </button>
            
            <div className={styles.trustBadges}>
              <span><Lock size={14} /> Pagamento processado com segurança</span>
              <span><Sparkles size={14} /> Imagem fictícia criada por IA</span>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

export default function CreatePage() {
  return (
    <Suspense fallback={<div style={{padding: '2rem', textAlign: 'center'}}>Carregando...</div>}>
      <CreateContent />
    </Suspense>
  );
}

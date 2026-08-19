"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud, CheckCircle2, ArrowRight, ArrowDown } from 'lucide-react';
import BeforeAfterSlider from './components/BeforeAfterSlider';
import styles from './page.module.css';
import { useFunnelSession } from './hooks/useFunnelSession';

type UploadStatus = 'IDLE' | 'VALIDATING' | 'UPLOADING' | 'UPLOADED' | 'ERROR';

export default function Home() {
  const router = useRouter();
  const { funnelData, updateFunnelData, trackEvent } = useFunnelSession();
  
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('IDLE');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showSticky, setShowSticky] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const uploadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    trackEvent('landing_view');
    
    const handleScroll = () => {
      if (!heroRef.current || !uploadRef.current) return;
      const heroBottom = heroRef.current.getBoundingClientRect().bottom;
      const uploadTop = uploadRef.current.getBoundingClientRect().top;
      const uploadBottom = uploadRef.current.getBoundingClientRect().bottom;
      
      const isPastHero = heroBottom < 0;
      const isLookingAtUpload = uploadTop < window.innerHeight && uploadBottom > 0;
      
      if (isPastHero && !isLookingAtUpload) {
        setShowSticky(true);
      } else {
        setShowSticky(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [trackEvent]);

  // Contextual CTA Logic
  const getNextStep = () => {
    if (funnelData?.orderId) return `/checkout/${funnelData.orderId}`;
    if (funnelData?.uploadId) return `/create?uploadId=${funnelData.uploadId}`;
    return null; // Means user should upload
  };

  const handleHeroCtaClick = () => {
    trackEvent('cta_clicked', { location: 'hero' });
    const nextRoute = getNextStep();
    if (nextRoute) {
      router.push(nextRoute);
    } else {
      uploadRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleStickyCtaClick = () => {
    trackEvent('cta_clicked', { location: 'sticky' });
    const nextRoute = getNextStep();
    if (nextRoute) {
      router.push(nextRoute);
    } else {
      uploadRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Upload Logic
  const resetUploadState = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setUploadError(null);
    setUploadStatus('IDLE');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    resetUploadState();
    trackEvent('upload_started');
    setUploadStatus('VALIDATING');
    
    if (selected.size > 10 * 1024 * 1024) {
      setUploadError("Arquivo muito grande (máx 10MB)");
      setUploadStatus('ERROR');
      return;
    }
    
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(selected.type)) {
      setUploadError("Formato não suportado. Use JPG, PNG ou WEBP");
      setUploadStatus('ERROR');
      return;
    }

    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setUploadStatus('UPLOADING');
    
    const formData = new FormData();
    formData.append('file', selected);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (res.ok && data.uploadId) {
        setUploadStatus('UPLOADED');
        updateFunnelData({ uploadId: data.uploadId });
        trackEvent('upload_completed', { uploadId: data.uploadId });
        
        // Auto-avanco! Nao obrigar clique em "Continuar"
        setTimeout(() => {
          router.push(`/create?uploadId=${data.uploadId}`);
        }, 1000);
      } else {
        setUploadError(data.error || "Não conseguimos enviar sua foto. Tente novamente.");
        setUploadStatus('ERROR');
      }
    } catch (err) {
      console.error(err);
      setUploadError("Não conseguimos enviar sua foto. Verifique a conexão e tente novamente.");
      setUploadStatus('ERROR');
    }
  };

  // Define Sticky CTA render logic based on Funnel State
  const renderStickyCtaText = () => {
    if (funnelData?.orderId) return "PAGAMENTO PENDENTE →";
    if (funnelData?.uploadId) return "01 ✓ ESCOLHER CENÁRIO";
    return "CRIAR MINHA FOTO";
  };

  return (
    <main className={styles.main}>
      {/* --- HERO --- */}
      <section className={styles.hero} ref={heroRef} onClick={() => trackEvent('hero_interaction')}>
        <div className="badge" style={{marginTop: '24px'}}>🇧🇷 ESPECIAL BRASIL</div>
        
        <div>
          <h1 className={styles.headline}>VOCÊ + BOLSONARO.</h1>
          <h1 className={styles.headline} style={{color: 'var(--foreground)'}}>EM UMA FOTO FEITA POR IA.</h1>
        </div>
        
        <p className={styles.subheadline}>
          Envie sua selfie. Escolha o cenário. A IA faz o resto.
        </p>

        {/* DEMO BEFORE/AFTER PREMIUM */}
        <div className={styles.demoWrapper} onTouchStart={() => trackEvent('before_after_interaction')}>
          <BeforeAfterSlider 
            beforeImage="/hero_original.jpg" 
            afterImage="/hero_generated_v2.jpg" 
          />
        </div>

        <div className={styles.priceBlock}>
          <div className={styles.price}>R$ 4,90</div>
          <div className={styles.priceSub}>pagamento único</div>
        </div>

        <button className="primary-btn" onClick={handleHeroCtaClick}>
          {funnelData?.uploadId ? 'CONTINUAR CRIAÇÃO' : 'CRIAR MINHA FOTO'} <ArrowRight size={24} />
        </button>
        
        <div className={styles.microcopyRow}>
          <span>⚡ Pagamento único</span>
          <span>🔒 Pagamento seguro</span>
          <span>✨ Resultado digital</span>
        </div>
        
        <div className={styles.disclaimer}>
          Montagem fictícia gerada por IA. Sem vínculo oficial.
        </div>
      </section>

      {/* --- UPLOAD SECTION --- */}
      <section className={styles.section} ref={uploadRef} style={{background: 'var(--card-bg)'}}>
        <h2 className={styles.sectionTitle}>AGORA É A SUA VEZ.</h2>
        <p className={styles.sectionSub}>Escolha uma selfie nítida para começar.</p>

        <input 
          type="file" 
          accept="image/jpeg, image/png, image/webp"
          ref={fileInputRef}
          style={{display: 'none'}}
          onChange={handleFileChange}
        />

        {uploadStatus === 'IDLE' && !preview && (
          <div className={styles.dropzone} onClick={() => fileInputRef.current?.click()}>
            <UploadCloud size={48} color="var(--accent-green)" />
            <span className={styles.dropzoneText}>ARRASTE SUA FOTO AQUI<br/><span style={{fontSize:'0.9rem', color:'#888', fontWeight:'normal'}}>ou ESCOLHER FOTO</span></span>
            <div style={{fontSize: '0.8rem', color: '#555'}}>Aceita JPG, PNG ou WEBP</div>
          </div>
        )}

        {(uploadStatus === 'UPLOADING' || uploadStatus === 'UPLOADED' || uploadStatus === 'ERROR') && (
          <div className={styles.previewContainer}>
            {uploadStatus === 'UPLOADED' && (
              <>
                <div className={styles.successStatus}>
                  <CheckCircle2 size={24} /> FOTO CARREGADA
                </div>
                <div style={{fontSize: '0.9rem', color: '#ccc', marginBottom: '8px'}}>Levando você para a próxima etapa...</div>
              </>
            )}
            
            {uploadStatus === 'ERROR' && (
              <>
                <div style={{color: 'red', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px'}}>
                  NÃO CONSEGUIMOS ENVIAR SUA FOTO
                </div>
                <div style={{fontSize: '0.9rem', color: '#ccc', marginBottom: '8px'}}>{uploadError}</div>
              </>
            )}

            {preview && (
              <img 
                src={preview} 
                alt="Sua selfie" 
                className={styles.previewImage} 
                style={{ opacity: uploadStatus === 'UPLOADING' ? 0.5 : 1 }}
              />
            )}
            
            {uploadStatus === 'UPLOADING' && (
              <button className="primary-btn" disabled style={{marginTop: '16px'}}>
                 <div className="spinner" style={{width: 20, height: 20}}></div> ENVIANDO...
              </button>
            )}
            
            {uploadStatus === 'ERROR' && (
              <button className="primary-btn" onClick={() => fileInputRef.current?.click()} style={{marginTop: '16px'}}>
                TENTAR NOVAMENTE <ArrowRight size={24} />
              </button>
            )}
            
            {uploadStatus === 'UPLOADED' && (
              <button className="primary-btn" disabled style={{marginTop: '16px'}}>
                <div className="spinner" style={{width: 20, height: 20}}></div> REDIRECIONANDO...
              </button>
            )}
          </div>
        )}
      </section>

      {/* --- TIMELINE SECTION COMPACT --- */}
      <section className={styles.section} style={{padding: '3rem 1.5rem'}}>
        <h2 className={styles.sectionTitle}>COMO FUNCIONA?</h2>
        
        <div className={styles.timeline}>
          <div className={styles.timelineItem}>
            <div className={styles.timelineNumber}>01</div>
            <div className={styles.timelineText}>ENVIE SUA SELFIE</div>
          </div>
          <ArrowDown className={styles.timelineArrow} />
          <div className={styles.timelineItem}>
            <div className={styles.timelineNumber}>02</div>
            <div className={styles.timelineText}>ESCOLHA UM CENÁRIO</div>
          </div>
          <ArrowDown className={styles.timelineArrow} />
          <div className={styles.timelineItem}>
            <div className={styles.timelineNumber}>03</div>
            <div className={styles.timelineText}>PAGUE R$4,90 NO PIX</div>
          </div>
          <ArrowDown className={styles.timelineArrow} />
          <div className={styles.timelineItem}>
            <div className={styles.timelineNumber} style={{color: 'var(--accent-green)'}}>04</div>
            <div className={styles.timelineText} style={{color: 'var(--accent-green)'}}>A IA ENTREGA SUA FOTO</div>
          </div>
        </div>
      </section>

      {/* --- CATALOG SECTION --- */}
      <section className={styles.section} style={{background: '#050505'}}>
        <h2 className={styles.sectionTitle}>ESCOLHA SEU CENÁRIO.</h2>
        <p className={styles.sectionSub}>Onde você quer aparecer?</p>

        <div className={`${styles.catalogScroll} no-scrollbar`}>
          <div className={styles.catalogCard}>
            <img src="/scenario_1.jpg" alt="Selfie Temática" className={styles.catalogImage} />
            <div className={styles.catalogOverlay}>
              <div className="badge" style={{marginBottom: '8px'}}>GERADO POR IA</div>
              <h3 className={styles.catalogName}>SELFIE TEMÁTICA</h3>
              <p style={{fontSize: '0.85rem', color: '#ccc', marginBottom: '8px'}}>Uma foto casual e próxima.</p>
              <div style={{color: 'var(--accent-green)', fontWeight: 'bold'}}>ESCOLHER →</div>
            </div>
          </div>

          <div className={styles.catalogCard}>
            <img src="/scenario_2.jpg" alt="Comício" className={styles.catalogImage} />
            <div className={styles.catalogOverlay}>
              <div className="badge" style={{marginBottom: '8px'}}>GERADO POR IA</div>
              <h3 className={styles.catalogName}>COMÍCIO VERDE E AMARELO</h3>
              <p style={{fontSize: '0.85rem', color: '#ccc', marginBottom: '8px'}}>Ambiente de evento patriota.</p>
              <div style={{color: 'var(--accent-green)', fontWeight: 'bold'}}>ESCOLHER →</div>
            </div>
          </div>

          <div className={styles.catalogCard}>
            <img src="/scenario_3.jpg" alt="Pôster" className={styles.catalogImage} />
            <div className={styles.catalogOverlay}>
              <div className="badge" style={{marginBottom: '8px'}}>GERADO POR IA</div>
              <h3 className={styles.catalogName}>PÔSTER CINEMATOGRÁFICO</h3>
              <p style={{fontSize: '0.85rem', color: '#ccc', marginBottom: '8px'}}>Composição heroica de cinema.</p>
              <div style={{color: 'var(--accent-green)', fontWeight: 'bold'}}>ESCOLHER →</div>
            </div>
          </div>
        </div>
      </section>

      {/* --- OFFER --- */}
      <section className={styles.section} style={{background: 'var(--card-bg)'}}>
        <h2 className={styles.sectionTitle}>SUA FOTO POR</h2>
        <div style={{color: 'var(--accent-yellow)', fontSize: '3.5rem', fontWeight: 900, lineHeight: 1, marginBottom: '2rem'}}>R$ 4,90.</div>
        
        <div className={styles.offerList}>
          <div className={styles.offerItem}><CheckCircle2 color="var(--accent-green)" /> 1 criação exclusiva</div>
          <div className={styles.offerItem}><CheckCircle2 color="var(--accent-green)" /> cenário escolhido</div>
          <div className={styles.offerItem}><CheckCircle2 color="var(--accent-green)" /> arquivo digital</div>
          <div className={styles.offerItem}><CheckCircle2 color="var(--accent-green)" /> pronto para compartilhar</div>
        </div>

        <button className="primary-btn" onClick={handleStickyCtaClick} style={{maxWidth: '300px', margin: '0 auto', marginBottom: '16px'}}>
          QUERO VER A MINHA <ArrowRight size={24} />
        </button>
        <div style={{fontSize: '0.8rem', color: '#888', display: 'flex', justifyContent: 'center', gap: '16px'}}>
          <span>🔒 Pagamento processado com segurança</span>
          <span>✨ Imagem criada por IA</span>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className={styles.footer}>
        <p><strong>Aviso Legal:</strong> Este serviço gera montagens fictícias através de Inteligência Artificial. Não possui qualquer vínculo com Jair Bolsonaro, seu partido ou equipe oficial. Não representa endosso, apoio político ou acontecimento real.</p>
        <p style={{marginTop: '1.5rem', color: '#444'}}>MITO.IA © 2026. Todos os direitos reservados.</p>
      </footer>

      {/* --- STICKY CTA MOBILE --- */}
      <div className={`${styles.stickyCta} ${showSticky ? styles.visible : ''}`}>
        {!funnelData?.uploadId && <div className={styles.stickyPrice}>R$ 4,90</div>}
        <button className="primary-btn" style={{padding: '16px 24px', width: funnelData?.uploadId ? '100%' : 'auto', fontSize: '1.1rem'}} onClick={handleStickyCtaClick}>
          {renderStickyCtaText()}
        </button>
      </div>
    </main>
  );
}

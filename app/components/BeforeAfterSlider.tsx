"use client";

import { useState, useRef, useEffect } from 'react';
import styles from './BeforeAfterSlider.module.css';

interface BeforeAfterSliderProps {
  beforeImage: string;
  afterImage: string;
  beforeLabel?: string;
  afterLabel?: string;
}

export default function BeforeAfterSlider({
  beforeImage,
  afterImage,
  beforeLabel = "ORIGINAL",
  afterLabel = "GERADO POR IA"
}: BeforeAfterSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = Math.max(0, Math.min((x / rect.width) * 100, 100));
    setSliderPosition(percent);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging) return;
    handleMove(e.touches[0].clientX);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', () => setIsDragging(false));
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', () => setIsDragging(false));
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', () => setIsDragging(false));
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', () => setIsDragging(false));
    };
  }, [isDragging]);

  return (
    <div 
      className={styles.container} 
      ref={containerRef}
      onMouseDown={(e) => {
        setIsDragging(true);
        handleMove(e.clientX);
      }}
      onTouchStart={(e) => {
        setIsDragging(true);
        handleMove(e.touches[0].clientX);
      }}
    >
      <div className={styles.imageContainer}>
        <img src={afterImage} alt="After" className={styles.image} />
        <div className={styles.labelRight}>{afterLabel}</div>
      </div>
      
      <div 
        className={styles.beforeContainer} 
        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
      >
        <img src={beforeImage} alt="Before" className={styles.image} />
        <div className={styles.labelLeft}>{beforeLabel}</div>
      </div>

      <div 
        className={styles.sliderLine}
        style={{ left: `${sliderPosition}%` }}
      >
        <div className={styles.sliderHandle}>
          <div className={styles.sliderArrowLeft}></div>
          <div className={styles.sliderArrowRight}></div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from 'react';

export interface FunnelData {
  funnelSessionId: string;
  uploadId?: string;
  scenarioId?: string;
  orderId?: string;
  paymentId?: string;
  generationId?: string;
  utms: { [key: string]: string };
}

// Generate a random ID for the session
const generateSessionId = () => Math.random().toString(36).substring(2, 15);

const FUNNEL_KEY = 'mito_funnel_session';

export function useFunnelSession() {
  const [funnelData, setFunnelData] = useState<FunnelData | null>(null);

  useEffect(() => {
    // Client-side initialization
    const stored = localStorage.getItem(FUNNEL_KEY);
    let data: FunnelData;
    
    if (stored) {
      try {
        data = JSON.parse(stored);
      } catch (e) {
        data = { funnelSessionId: generateSessionId(), utms: {} };
      }
    } else {
      data = { funnelSessionId: generateSessionId(), utms: {} };
    }

    // Capture UTMs from URL if present
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      let updatedUtms = false;
      const keysToCapture = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'];
      
      keysToCapture.forEach(key => {
        const val = params.get(key);
        if (val) {
          data.utms[key] = val;
          updatedUtms = true;
        }
      });

      if (updatedUtms || !stored) {
        localStorage.setItem(FUNNEL_KEY, JSON.stringify(data));
      }
    }

    setFunnelData(data);
  }, []);

  const updateFunnelData = (updates: Partial<FunnelData>) => {
    setFunnelData(prev => {
      const next = { ...prev, ...updates } as FunnelData;
      if (!next.funnelSessionId) next.funnelSessionId = generateSessionId();
      if (!next.utms) next.utms = {};
      localStorage.setItem(FUNNEL_KEY, JSON.stringify(next));
      return next;
    });
  };

  const clearFunnelData = () => {
    localStorage.removeItem(FUNNEL_KEY);
    setFunnelData({ funnelSessionId: generateSessionId(), utms: {} });
  };

  // Tracking function with deduplication per session per event
  const trackEvent = (eventName: string, metadata?: any) => {
    if (typeof window === 'undefined') return;
    
    // Simple dedup using session storage (resets on tab close)
    const trackedKey = `tracked_${eventName}`;
    if (sessionStorage.getItem(trackedKey)) return; // Already tracked this session

    const payload = {
      event: eventName,
      funnelSessionId: funnelData?.funnelSessionId,
      utms: funnelData?.utms,
      timestamp: new Date().toISOString(),
      ...metadata
    };

    console.log(`[TRACKER EVENT]: ${eventName}`, payload);
    
    // Avoid double tracking standard events in the same tab session
    // For repeatable actions (like clicks) we might bypass this, but for core funnel it's good.
    const uniqueEvents = ['landing_view', 'checkout_viewed', 'payment_approved', 'pix_created', 'upload_completed'];
    if (uniqueEvents.includes(eventName)) {
      sessionStorage.setItem(trackedKey, 'true');
    }

    // TODO: Send to backend / Meta CAPI later
  };

  return {
    funnelData,
    updateFunnelData,
    clearFunnelData,
    trackEvent
  };
}

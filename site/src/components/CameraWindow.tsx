// A camera view for filming the robot next to the site, so one screen recording catches both.
// The camera runs while the window is open; ● Rec also saves the camera on its own as a video file.

import { useEffect, useRef, useState } from "react";

const TYPES = ["video/mp4", "video/webm;codecs=vp9,opus", "video/webm"];

const clock = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

export function CameraWindow({ onError }: { onError: (message: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [camera, setCamera] = useState("");
  const [mirror, setMirror] = useState(false);
  const [sound, setSound] = useState(true);
  const [size, setSize] = useState("");
  const [since, setSince] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const report = useRef(onError);
  report.current = onError;

  useEffect(() => {
    let gone = false;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: camera ? { exact: camera } : undefined, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (gone) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        video.current!.srcObject = s;
        const { width, height } = s.getVideoTracks()[0].getSettings();
        setSize(width && height ? `${width}×${height}` : "");
        // Labels only show once a camera is allowed.
        const all = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
        if (!gone) setCameras(all);
      } catch (e) {
        report.current(`Camera: ${e instanceof Error ? e.message : String(e)}`);
      }
    })();
    return () => {
      gone = true;
      recorder.current?.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
    };
  }, [camera]);

  useEffect(() => {
    if (since === null) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [since]);

  const record = async () => {
    if (recorder.current) return recorder.current.stop();
    if (!stream.current) return;
    const tracks = [...stream.current.getVideoTracks()];
    let mic: MediaStream | null = null;
    if (sound) {
      try {
        mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
        tracks.push(...mic.getAudioTracks());
      } catch (e) {
        onError(`Microphone: ${e instanceof Error ? e.message : String(e)}. Recording without sound.`);
      }
    }
    const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    const r = new MediaRecorder(new MediaStream(tracks), mimeType ? { mimeType, videoBitsPerSecond: 8_000_000 } : undefined);
    const parts: Blob[] = [];
    r.ondataavailable = (e) => e.data.size && parts.push(e.data);
    r.onstop = () => {
      mic?.getTracks().forEach((t) => t.stop());
      recorder.current = null;
      setSince(null);
      const blob = new Blob(parts, { type: r.mimeType });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `vocal2piano-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}.${r.mimeType.startsWith("video/mp4") ? "mp4" : "webm"}`;
      a.click();
      URL.revokeObjectURL(a.href);
    };
    r.start(1000);
    recorder.current = r;
    setSince(Date.now());
    setNow(Date.now());
  };

  return (
    <div className="win-body">
      <div className="toolbar">
        <button className={`btn ${since !== null ? "pressed" : ""}`} onClick={record} title="Save the camera as a video file (closing or minimizing the window stops and saves it)">
          <i className={`led ${since !== null ? "on" : ""}`} />
          {since !== null ? `■ Stop ${clock(Math.round((now - since) / 1000))}` : "Rec"}
        </button>
        <label className="check" title="Record the microphone too">
          <input type="checkbox" checked={sound} disabled={since !== null} onChange={(e) => setSound(e.target.checked)} />
          <span>Sound</span>
        </label>
        <label className="check" title="Show the picture like a mirror (recordings are never mirrored)">
          <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} />
          <span>Mirror</span>
        </label>
        <span className="grow" />
        {size && <span className="camera-size">{size}</span>}
        {cameras.length > 1 && (
          <select value={camera} disabled={since !== null} onChange={(e) => setCamera(e.target.value)} aria-label="Camera">
            <option value="">Default camera</option>
            {cameras.map((c, i) => (
              <option key={c.deviceId} value={c.deviceId}>
                {c.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        )}
      </div>
      <video ref={video} className={`camera sunken ${mirror ? "mirror" : ""}`} autoPlay muted playsInline />
    </div>
  );
}

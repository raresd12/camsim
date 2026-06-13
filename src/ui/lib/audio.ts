/** Web Audio helpers (DOM side): decoding for fluency analysis, beep test. */

export interface DecodedAudio {
  samples: Float32Array;
  sampleRate: number;
}

/** Decode a recording Blob to mono PCM samples for fluency analysis. */
export async function decodeBlobToMono(blob: Blob): Promise<DecodedAudio> {
  const ctx = new AudioContext();
  try {
    const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
    const length = buffer.length;
    const mono = new Float32Array(length);
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) mono[i] += data[i];
    }
    if (buffer.numberOfChannels > 1) {
      for (let i = 0; i < length; i++) mono[i] /= buffer.numberOfChannels;
    }
    return { samples: mono, sampleRate: buffer.sampleRate };
  } finally {
    void ctx.close();
  }
}

/** Short two-tone beep used by the lobby audio check. */
export async function playTestBeep(): Promise<void> {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.value = 0.15;
  osc.frequency.value = 440;
  osc.start();
  osc.frequency.setValueAtTime(660, ctx.currentTime + 0.25);
  osc.stop(ctx.currentTime + 0.5);
  await new Promise((r) => setTimeout(r, 600));
  await ctx.close();
}

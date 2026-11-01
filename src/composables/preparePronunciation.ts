// Some output devices need time to wake after being idle. Put a short silent
// lead-in in the media itself so playback has started before the word begins.
export async function preparePronunciation(blob: Blob, playbackRate: number): Promise<Blob> {
  if (typeof OfflineAudioContext === 'undefined') return blob;
  try {
    const decoder = new OfflineAudioContext(1, 1, 44100);
    const decoded = await decoder.decodeAudioData(await blob.arrayBuffer());
    const channels = decoded.numberOfChannels;
    if (channels < 1 || channels > 2 || decoded.duration > 30) return blob;
    const leadFrames = Math.ceil(decoded.sampleRate * 0.3 * playbackRate);
    const frames = leadFrames + decoded.length;
    const bytesPerFrame = channels * 2;
    const buffer = new ArrayBuffer(44 + frames * bytesPerFrame);
    const view = new DataView(buffer);
    const writeText = (offset: number, value: string) => {
      for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
    };
    writeText(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true);
    writeText(8, 'WAVE'); writeText(12, 'fmt '); view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); view.setUint16(22, channels, true);
    view.setUint32(24, decoded.sampleRate, true); view.setUint32(28, decoded.sampleRate * bytesPerFrame, true);
    view.setUint16(32, bytesPerFrame, true); view.setUint16(34, 16, true);
    writeText(36, 'data'); view.setUint32(40, frames * bytesPerFrame, true);
    const samples = Array.from({ length: channels }, (_, channel) => decoded.getChannelData(channel));
    for (let frame = 0; frame < decoded.length; frame++) for (let channel = 0; channel < channels; channel++) {
      const sample = Math.max(-1, Math.min(1, samples[channel]![frame]!));
      view.setInt16(44 + ((frame + leadFrames) * channels + channel) * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
    }
    return new Blob([buffer], { type: 'audio/wav' });
  } catch {
    // Unsupported formats and decoders can still use the original browser player.
    return blob;
  }
}

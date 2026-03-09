import { registerTransform } from './registry';

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) return null;
  const byteSize = Math.ceil((match[2].length * 3) / 4);
  return {
    mimeType: match[1],
    format: match[1].replace('image/', '').toUpperCase(),
    sizeBytes: byteSize,
    sizeFormatted:
      byteSize > 1024 * 1024
        ? `${(byteSize / (1024 * 1024)).toFixed(2)} MB`
        : `${(byteSize / 1024).toFixed(1)} KB`,
  };
}

registerTransform({
  id: 'image-diff',
  name: 'Image Diff',
  description: 'Compare two images visually',
  category: 'Image',
  inputs: 2,
  inputViews: ['raw-input', 'image-input'],
  outputViews: ['raw-output', 'image-split', 'image-fade', 'image-slider', 'image-highlight', 'image-details'],
  fn: (a, b) => {
    if (!a && !b) return 'Drop or paste images in both inputs';
    if (!a) return 'Image A is missing';
    if (!b) return 'Image B is missing';
    if (!a.startsWith('data:image')) return 'Input A is not an image';
    if (!b.startsWith('data:image')) return 'Input B is not an image';

    const infoA = parseDataUrl(a);
    const infoB = parseDataUrl(b);
    if (!infoA || !infoB) return 'Could not parse image data';

    return JSON.stringify(
      {
        imageA: infoA,
        imageB: infoB,
        summary: `Comparing ${infoA.format} (${infoA.sizeFormatted}) vs ${infoB.format} (${infoB.sizeFormatted})`,
      },
      null,
      2,
    );
  },
});

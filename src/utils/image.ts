const MAX_EDGE = 512;
const JPEG_QUALITY = 0.72;
const MAX_DATA_URL_BYTES = 120_000;

/** 将上传图片压缩为临时 data URL，仅本局通过 P2P 下发，不持久化。 */
export function compressRoleImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error('请选择图片文件。'));
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('无法处理图片。'));
        return;
      }
      context.fillStyle = '#111';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      if (dataUrl.length > MAX_DATA_URL_BYTES) {
        reject(new Error('图片太大，请换一张更小的图。'));
        return;
      }
      resolve(dataUrl);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('图片读取失败。'));
    };
    image.src = objectUrl;
  });
}

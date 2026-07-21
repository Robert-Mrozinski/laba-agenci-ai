'use client';

export type AttachedImage = {
  dataUrl: string;
  name: string;
};

const acceptedImageTypes = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
]);

const maxImageSize = 4 * 1024 * 1024;

export function isAcceptedImage(file: File) {
  return acceptedImageTypes.has(file.type);
}

export function readImageFile(file: File): Promise<AttachedImage> {
  if (!isAcceptedImage(file)) {
    return Promise.reject(
      new Error('Akceptuję tylko obrazy PNG, JPG, JPEG, GIF lub WEBP.'),
    );
  }

  if (file.size > maxImageSize) {
    return Promise.reject(new Error('Max 4MB. Zrób screenshot fragmentu.'));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        resolve({
          dataUrl: reader.result,
          name: file.name || 'Screenshot',
        });
        return;
      }

      reject(new Error('Nie udało się odczytać obrazu.'));
    });

    reader.addEventListener('error', () => {
      reject(new Error('Nie udało się odczytać obrazu.'));
    });

    reader.readAsDataURL(file);
  });
}

export function imageFromClipboard(items: DataTransferItemList) {
  return Array.from(items)
    .find((item) => item.type.startsWith('image/'))
    ?.getAsFile();
}

export function imageFromDrop(files: FileList) {
  return Array.from(files).find((file) => file.type.startsWith('image/'));
}

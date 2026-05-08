import * as ImageManipulator from 'expo-image-manipulator';

const MAX_DIM = 1280;
const QUALITY = 0.85;

interface ImageAsset {
  uri: string;
  width?: number;
  height?: number;
  fileSize?: number;
}

export async function compressImage(asset: ImageAsset): Promise<string> {
  const { uri, width = 0, height = 0, fileSize = Infinity } = asset;

  if (fileSize < 500 * 1024) return uri;

  const maxSide = Math.max(width, height);
  if (maxSide === 0 || maxSide <= MAX_DIM) {
    // Still re-encode to JPEG for consistency, skip resize
    const result = await ImageManipulator.manipulateAsync(
      uri, [], { compress: QUALITY, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result.uri;
  }

  const scale = MAX_DIM / maxSide;
  const newWidth = Math.round(width * scale);

  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: newWidth } }],
    { compress: QUALITY, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

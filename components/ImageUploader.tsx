import React, { useRef, useState, useEffect } from 'react';
// Fix: Corrected import path for blobToBase64 from services/geminiService.ts
import { blobToBase64 } from '../services/geminiService';

interface ImageUploaderProps {
  onImageSelected: (base64Image: string, mimeType: string, imageUrl: string) => void;
  isLoading: boolean;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelected, isLoading }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isCameraActive) {
      activateCamera();
    } else {
      deactivateCamera();
    }
    // Cleanup function
    return () => {
      deactivateCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCameraActive]);

  const activateCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setCameraError('Could not access camera. Please ensure permissions are granted.');
      setIsCameraActive(false);
    }
  };

  const deactivateCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsCameraActive(false);
      setImagePreviewUrl(URL.createObjectURL(file));

      try {
        const base64 = await blobToBase64(file);
        onImageSelected(base64, file.type, URL.createObjectURL(file));
      } catch (error) {
        console.error('Error converting file to base64:', error);
        alert('Failed to process image file.');
      }
    }
  };

  const handleCapturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          async (blob) => {
            if (blob) {
              const mimeType = 'image/jpeg';
              setImagePreviewUrl(URL.createObjectURL(blob));
              try {
                const base64 = await blobToBase64(blob);
                onImageSelected(base64, mimeType, URL.createObjectURL(blob));
                setIsCameraActive(false); // Deactivate camera after capture
              } catch (error) {
                console.error('Error converting camera image to base64:', error);
                alert('Failed to process camera image.');
              }
            }
          },
          'image/jpeg',
          0.9
        );
      }
    }
  };

  return (
    <div className="flex flex-col items-center p-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-800 space-y-4">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Upload Item Image</h2>

      {imagePreviewUrl && (
        <div className="w-64 h-64 border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden flex items-center justify-center bg-gray-50 dark:bg-gray-700">
          <img src={imagePreviewUrl} alt="Item Preview" className="max-w-full max-h-full object-contain" />
        </div>
      )}

      {isCameraActive && (
        <div className="relative w-full max-w-md bg-black rounded-lg overflow-hidden">
          <video ref={videoRef} autoPlay playsInline className="w-full h-auto object-cover rounded-lg"></video>
          <canvas ref={canvasRef} className="hidden"></canvas>
          <button
            onClick={handleCapturePhoto}
            disabled={isLoading}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 px-6 py-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? 'Processing...' : 'Capture Photo'}
          </button>
        </div>
      )}

      {cameraError && <p className="text-red-500 dark:text-red-400 text-sm">{cameraError}</p>}

      <div className="flex flex-wrap gap-4 justify-center w-full">
        <button
          onClick={() => setIsCameraActive(!isCameraActive)}
          disabled={isLoading}
          className="px-5 py-2 bg-purple-600 text-white rounded-md shadow hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isCameraActive ? 'Close Camera' : 'Open Camera'}
        </button>

        <label htmlFor="file-upload" className="px-5 py-2 bg-green-600 text-white rounded-md shadow hover:bg-green-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          Upload from File
          <input
            id="file-upload"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={isLoading}
            className="hidden"
          />
        </label>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
        Upload an image from your device or use the camera to identify the item.
      </p>
    </div>
  );
};

export default ImageUploader;
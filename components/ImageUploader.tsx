import React, { useRef, useState, useEffect, useCallback } from 'react';
import { blobToBase64 } from '../services/geminiService';

interface ImageUploaderProps {
  onImageSelected: (base64Image: string, mimeType: string) => void;
  isLoading: boolean;
}

const LOCAL_STORAGE_CAMERA_DEVICE_KEY = 'selectedCameraDeviceId';

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelected, isLoading }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(LOCAL_STORAGE_CAMERA_DEVICE_KEY);
    }
    return null;
  });

  const currentStreamRef = useRef<MediaStream | null>(null); // Use a ref to hold the current stream

  // --- Effect 1: Enumerate video devices and set initial selected device ---
  useEffect(() => {
    const enumerateCameras = async () => {
      try {
        setCameraError(null); // Clear previous errors during enumeration attempt

        // Attempt to get user media to ensure device labels are populated.
        // This is non-blocking for enumeration even if permission is denied.
        let streamForLabels: MediaStream | null = null;
        try {
          streamForLabels = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          streamForLabels.getTracks().forEach(track => track.stop()); // Stop immediately
        } catch (err: any) {
          console.warn("Initial getUserMedia for enumeration (to get labels) failed:", err);
          // If permission is denied or no camera found here, enumerateDevices might return empty labels or fail.
          // We still proceed to enumerate to see what's available.
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        console.log('All enumerated devices:', devices); // DEBUG: Log all devices
        const videoInputDevices = devices.filter(device => device.kind === 'videoinput');
        setVideoDevices(videoInputDevices);
        console.log('Filtered video input devices:', videoInputDevices); // DEBUG: Log filtered video devices

        if (videoInputDevices.length > 0) {
          const savedDeviceId = localStorage.getItem(LOCAL_STORAGE_CAMERA_DEVICE_KEY);
          // Check if saved deviceId is still valid and present in the current list
          const isValidSavedDevice = savedDeviceId && videoInputDevices.some(device => device.deviceId === savedDeviceId);

          if (isValidSavedDevice) {
            setSelectedDeviceId(savedDeviceId);
            console.log('Selected saved camera device:', savedDeviceId); // DEBUG
          } else {
            // Default to the first available camera if saved one is invalid or not present
            setSelectedDeviceId(videoInputDevices[0].deviceId);
            localStorage.setItem(LOCAL_STORAGE_CAMERA_DEVICE_KEY, videoInputDevices[0].deviceId);
            console.log('Defaulted to first camera device:', videoInputDevices[0].deviceId); // DEBUG
          }
        } else {
          setCameraError('No camera devices detected by your browser. Please ensure your camera is connected, powered on, and that your browser has permission to access it.');
          setSelectedDeviceId(null); // Explicitly set to null if no devices found
          console.log('No video input devices found.'); // DEBUG
        }
      } catch (err: any) {
        console.error('Error enumerating camera devices:', err);
        setCameraError(`Could not list camera devices: ${err.message || 'Unknown error'}. This often indicates a browser permission issue or that no camera is available.`);
        setSelectedDeviceId(null); // Ensure null on any enumeration error
      }
    };

    // Ensure this runs only client-side
    if (typeof window !== 'undefined' && navigator.mediaDevices) {
      enumerateCameras();
    }
  }, []); // Run once on mount

  // --- Effect 2: Manage camera stream lifecycle based on isCameraActive and selectedDeviceId ---
  useEffect(() => {
    const videoElement = videoRef.current;
    
    const stopCamera = () => {
      if (videoElement && videoElement.srcObject) {
        videoElement.srcObject = null; // Detach stream from video element first
      }
      if (currentStreamRef.current) {
        currentStreamRef.current.getTracks().forEach(track => track.stop());
        currentStreamRef.current = null;
      }
    };

    const startCamera = async () => {
      setCameraError(null);

      // If no device is explicitly selected, try to auto-select the first available
      if (!selectedDeviceId && videoDevices.length > 0) {
          setSelectedDeviceId(videoDevices[0].deviceId);
          return; // Let the effect re-run with the updated selectedDeviceId
      }
      if (!selectedDeviceId || videoDevices.length === 0) {
          setCameraError('No camera devices available or selected. Please ensure your camera is connected and permissions are granted.');
          setIsCameraActive(false);
          return;
      }

      try {
        const constraints: MediaStreamConstraints = {
          video: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true,
          audio: false, // Explicitly request no audio
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        currentStreamRef.current = stream; // Assign to ref for capture function

        if (videoElement) {
          videoElement.srcObject = stream;
          videoElement.play().catch(e => {
            // Filter out common, expected errors during cleanup/unmount
            if (e.name !== 'AbortError' && e.name !== 'NotSupportedError' && !e.message.includes("The fetching process for the media resource was aborted")) {
              console.error("Error playing video:", e);
              setCameraError(`Error playing camera feed: ${e.message || e.name}. Please try selecting a different camera.`);
            }
          });
        }
      } catch (error: any) {
        console.error('Error accessing camera:', error);
        let errorMessage = 'Could not access camera. Please ensure permissions are granted.';
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Camera access denied. Please allow camera permissions in your browser settings to use this feature.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No camera found. Please ensure a camera is connected and enabled, or try selecting a different one.';
        } else if (error.name === 'NotReadableError') {
          errorMessage = 'Camera is in use by another application or not available.';
        } else if (error.name === 'OverconstrainedError') {
          errorMessage = `Camera constraints could not be satisfied: ${error.message}. Try selecting a different camera or check your settings.`;
        } else {
          errorMessage = `Could not access camera: ${error.message}. Please try again or check your system settings.`;
        }
        setCameraError(errorMessage);
        setIsCameraActive(false); // Turn off camera active state on error
        currentStreamRef.current = null; // Clear ref on error
      }
    };

    if (isCameraActive) {
      startCamera();
    } else {
      stopCamera();
    }

    // Cleanup function: runs on unmount or when dependencies change (and effect re-runs)
    return () => {
      stopCamera();
    };
  }, [isCameraActive, selectedDeviceId, videoDevices, videoRef]); // Depend on videoDevices for re-evaluation if devices change

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsCameraActive(false); // Ensure camera is off when file is uploaded
      setImagePreviewUrl(URL.createObjectURL(file));

      try {
        const base64 = await blobToBase64(file);
        onImageSelected(base64, file.type);
      } catch (error) {
        console.error('Error converting file to base64:', error);
        alert('Failed to process image file.');
      }
    }
  };

  const handleCapturePhoto = useCallback(async () => {
    if (videoRef.current && canvasRef.current && currentStreamRef.current) {
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
                onImageSelected(base64, mimeType);
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
    } else {
        setCameraError('Cannot capture photo: camera is not active or video element is not ready.');
    }
  }, [onImageSelected]);

  const handleDeviceChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newDeviceId = event.target.value;
    setSelectedDeviceId(newDeviceId);
    localStorage.setItem(LOCAL_STORAGE_CAMERA_DEVICE_KEY, newDeviceId);
    // If camera is active, changing selectedDeviceId will trigger the useEffect to restart the stream
  };

  return (
    <div className="flex flex-col items-center p-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-800 space-y-4">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Upload Item Image</h2>

      {imagePreviewUrl && (
        <div className="w-64 h-64 border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden flex items-center justify-center bg-gray-50 dark:bg-gray-700">
          <img src={imagePreviewUrl} alt="Item Preview" className="max-w-full max-h-full object-contain" />
        </div>
      )}

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

      {isCameraActive && videoDevices.length > 1 && ( // Only show dropdown if camera is active and multiple devices exist
        <div className="w-full max-w-md">
          <label htmlFor="camera-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Select Camera:
          </label>
          <select
            id="camera-select"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            onChange={handleDeviceChange}
            value={selectedDeviceId || ''}
            disabled={isLoading}
          >
            {videoDevices.map(device => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${device.deviceId.substring(0, 8)}`} {/* Fallback label */}
              </option>
            ))}
          </select>
        </div>
      )}

      {isCameraActive && (
        <div className="relative w-full max-w-md bg-black rounded-lg overflow-hidden">
          {/* srcObject is set imperatively in the useEffect hook */}
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

      {cameraError && <p className="text-red-500 dark:text-red-400 text-sm mt-2">{cameraError}</p>}


      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
        Upload an image from your device or use the camera to identify the item.
      </p>
    </div>
  );
};

export default ImageUploader;
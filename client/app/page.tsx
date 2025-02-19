"use client"
import React, { useState, useRef, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils";
import Image from 'next/image';

interface EmotionData {
  emotion: string;
  score: number;
}

export default function EmotionFoodPage() {
  const [isActive, setIsActive] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState<EmotionData>({
    emotion: 'neutral',
    score: 0.48
  });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      streamRef.current = stream;
      setIsActive(true);
      startEmotionTracking();
    } catch (err) {
      toast({
        title: "Camera Error",
        description: "Could not access webcam",
        variant: "destructive"
      });
    }
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  };

  const captureAndAnalyze = async () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0);
    
    try {
      const blob = await new Promise<Blob>((resolve) => 
        canvas.toBlob((b) => resolve(b as Blob), 'image/jpeg')
      );
      
      const formData = new FormData();
      formData.append('image', blob);

      const response = await fetch('http://localhost:8000/analyze_emotion', {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      setCurrentEmotion(data);
      
      if (data.emotion === 'sad' && data.score > 0.5) {
        await sendFoodImage();
      }
    } catch (err) {
      console.error('Error analyzing emotion:', err);
    }
  };

  const startEmotionTracking = () => {
    const interval = setInterval(captureAndAnalyze, 1000);
    return () => clearInterval(interval);
  };

  const sendFoodImage = async () => {
    try {
      const response = await fetch('http://localhost:8000/send_food', {
        method: 'POST'
      });
      
      if (response.ok) {
        toast({
          title: "Food Image Sent!",
          description: "Check your phone for some delicious inspiration",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Could not send food image",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, []);

  return (
    <div className="min-h-screen bg-black text-white font-inter">
      <div className="max-w-4xl mx-auto p-6">
        {/* Logo */}
        <div className="flex justify-center w-full mb-6">
  <div className="relative flex items-center w-[120px] h-[40px] md:w-[150px] md:h-[50px]">
    <Image
      src="/ohmymood.svg"
      alt="OhMyMood Logo"
      fill
      className="object-contain"
    />
  </div>
</div>


        <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm overflow-hidden">
          <div className="relative aspect-video">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover rounded-t-lg"
            />
            
            {!isActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-900/90">
                <Camera className="w-12 h-12 text-fuchsia-500/50" />
                <span className="text-zinc-400 text-sm">Click below to start</span>
              </div>
            )}
            
            {isActive && (
              <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="animate-pulse w-2 h-2 rounded-full bg-fuchsia-500" />
                    <span className="text-sm font-medium text-zinc-300">
                      Detecting Emotions
                    </span>
                  </div>
                  {currentEmotion.emotion !== 'neutral' && (
                    <div className="text-sm font-medium">
                      <span className="text-zinc-400">Mood: </span>
                      <span className="text-fuchsia-400">
                        {currentEmotion.emotion} ({Math.round(currentEmotion.score * 100)}%)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-zinc-800/50">
            <Button 
              variant="ghost"
              className={cn(
                "w-full h-12 text-sm font-medium tracking-wide transition-all duration-300",
                isActive 
                  ? "text-red-400 hover:text-red-300 hover:bg-red-950/30"
                  : "text-fuchsia-400 hover:text-fuchsia-300 hover:bg-fuchsia-950/30"
              )}
              onClick={() => isActive ? stopWebcam() : startWebcam()}
            >
              {isActive ? "STOP CAMERA" : "START CAMERA"}
            </Button>
          </div>
        </Card>

        <div className="mt-6 flex justify-center gap-6">
          {[
            { name: 'Camera', status: isActive },
            { name: 'Emotion Detection', status: isActive },
            { name: 'Food Service', status: true }
          ].map(({ name, status }) => (
            <div 
              key={name}
              className="flex items-center gap-2 text-xs text-zinc-500"
            >
              <div 
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-colors duration-300",
                  status ? "bg-fuchsia-500" : "bg-zinc-700"
                )}
              />
              {name}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
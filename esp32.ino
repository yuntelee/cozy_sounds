import { useRef } from 'react';

export const useFadingAudio = (audioUrl) => {
  const audioRef = useRef(new Audio(audioUrl));
  const fadeIntervalRef = useRef(null);

  const fadeTimeMs = 5000; 
  const steps = 50; // Smoothness of the fade
  const stepDuration = fadeTimeMs / steps;

  const playWithFadeIn = () => {
    const audio = audioRef.current;
    clearInterval(fadeIntervalRef.current);
    
    audio.volume = 0;
    audio.play();
    
    let currentStep = 0;
    fadeIntervalRef.current = setInterval(() => {
      currentStep++;
      audio.volume = currentStep / steps;
      if (currentStep >= steps) {
        clearInterval(fadeIntervalRef.current);
      }
    }, stepDuration);
  };

  const stopWithFadeOut = () => {
    const audio = audioRef.current;
    clearInterval(fadeIntervalRef.current);
    
    let currentStep = steps;
    fadeIntervalRef.current = setInterval(() => {
      currentStep--;
      audio.volume = currentStep / steps;
      if (currentStep <= 0) {
        clearInterval(fadeIntervalRef.current);
        audio.pause();
        audio.currentTime = 0; // Reset track
      }
    }, stepDuration);
  };

  return { playWithFadeIn, stopWithFadeOut };
};
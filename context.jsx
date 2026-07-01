'use client';
import { createContext, useContext } from 'react';

// Decouples storydeck from any specific consumer/deploy. The consumer wraps its app once and
// provides deploy-time config (base path for assets). storydeck components read it from context
// instead of importing consumer files — so the engine drops into any app.
const StoryDeckContext = createContext({ basePath: '' });

export function StoryDeckProvider({ basePath = '', children }) {
  return <StoryDeckContext.Provider value={{ basePath }}>{children}</StoryDeckContext.Provider>;
}

export function useBasePath() {
  return useContext(StoryDeckContext).basePath;
}

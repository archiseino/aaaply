export const API_PRESETS = [
  { name: "Akun 1", key: "" },
  { name: "Akun 2", key: "" },
  { name: "Akun 3", key: "" },
  { name: "Akun 4", key: "" },
  { name: "Akun 5", key: "" },
  { name: "Akun 6", key: "" },
  { name: "Akun 7", key: "" },
  { name: "Akun 8", key: "" },
  { name: "Akun 9", key: "" },
  { name: "Akun 10", key: "" },
];

export function rotateApiKey(currentKey: string) {
  const currentIndex = API_PRESETS.findIndex(p => p.key === currentKey);
  if (currentIndex === -1) return null;
  
  // Find next non-empty key
  for (let i = 1; i < API_PRESETS.length; i++) {
    const nextIndex = (currentIndex + i) % API_PRESETS.length;
    if (API_PRESETS[nextIndex].key) {
      localStorage.setItem('GEMINI_API_KEY', API_PRESETS[nextIndex].key);
      return { 
        nextKey: API_PRESETS[nextIndex].key, 
        nextName: API_PRESETS[nextIndex].name 
      };
    }
  }
  
  return null;
}

import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Snout OS - Sitter',
    short_name: 'Snout OS',
    description: 'Pet care sitter app — Today schedule, visits, and reports',
    start_url: '/sitter/today',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0d9488',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}

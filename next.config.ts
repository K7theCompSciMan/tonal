import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow images from YouTube, iTunes, Jamendo, and Unsplash
  // so Next.js <Image> can be used if needed, and CORS doesn't block thumbnails.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "is1-ssl.mzstatic.com" },
      { protocol: "https", hostname: "is2-ssl.mzstatic.com" },
      { protocol: "https", hostname: "is3-ssl.mzstatic.com" },
      { protocol: "https", hostname: "is4-ssl.mzstatic.com" },
      { protocol: "https", hostname: "is5-ssl.mzstatic.com" },
      { protocol: "https", hostname: "**.jamendo.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },

  // Suppress noisy but harmless console warnings from the YouTube iframe embed.
  // The "postMessage target origin" error and Feature Policy warnings come from
  // react-player's YouTube backend communicating with the iframe — they don't
  // affect functionality and can't be fixed from our side.
  //
  // We silence them by overriding console.error in the browser only (see globals.css
  // or a client-side useEffect in layout.tsx). Next.js itself can't suppress
  // browser console output, but we can filter known-harmless messages.

  async headers() {
    return [
      {
        // Allow YouTube iframes to communicate with our page (needed for react-player)
        source: "/(.*)",
        headers: [
          {
            key: "Permissions-Policy",
            // Suppress the "Feature Policy: Skipping unsupported feature" warnings
            // by explicitly declaring which features we allow/deny.
            value: [
              "camera=()",
              "microphone=()",
              "geolocation=()",
              "gyroscope=()",
              "accelerometer=()",
              "magnetometer=()",
              "picture-in-picture=(self)",
              "fullscreen=(self)",
              "encrypted-media=(self)",
              "autoplay=(self)",
            ].join(", "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
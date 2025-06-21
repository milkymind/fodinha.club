import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        
        {/* Modern SVG favicon (preferred) */}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        
        {/* Fallback favicon formats */}
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="shortcut icon" href="/favicon.ico" />
        
        {/* Apple Touch Icon */}
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        
        {/* Android Chrome */}
        <link rel="icon" type="image/png" sizes="192x192" href="/android-chrome-192x192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/android-chrome-512x512.png" />
        
        {/* Web App Manifest */}
        <link rel="manifest" href="/site.webmanifest" />
        
        {/* Theme color for mobile browsers */}
        <meta name="theme-color" content="#ff8400" />
        
        {/* Meta tags for better SEO */}
        <meta name="description" content="Play Fodinha online, and join the club!" />
        <meta name="keywords" content="fodinha, card game, brazilian, online, multiplayer, club, games, entertainment, social" />
        <meta name="author" content="Fodinha.Club" />
        
        {/* Open Graph meta tags for social sharing */}
        <meta property="og:title" content="FODINHA.CLUB" />
        <meta property="og:description" content="Play Fodinha online, and join the club!" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/android-chrome-512x512.png" />
        <meta property="og:image:width" content="512" />
        <meta property="og:image:height" content="512" />
        
        {/* Twitter Card meta tags */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="FODINHA.CLUB" />
        <meta name="twitter:description" content="Play Fodinha online, and join the club!" />
        <meta name="twitter:image" content="/android-chrome-512x512.png" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
} 
import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Basic favicon */}
        <link rel="icon" href="/favicon.ico" />
        
        {/* Modern favicon formats */}
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        
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
        <meta name="description" content="Fodinha.Club - Brazilian card game. Play with friends online!" />
        <meta name="keywords" content="fodinha, card game, brazilian, online, multiplayer, club" />
        <meta name="author" content="Fodinha.Club" />
        
        {/* Open Graph meta tags for social sharing */}
        <meta property="og:title" content="Fodinha.Club - Brazilian Card Game" />
        <meta property="og:description" content="Play Fodinha, the classic Brazilian card game, online with friends!" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/og-image.png" />
        
        {/* Twitter Card meta tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Fodinha.Club - Brazilian Card Game" />
        <meta name="twitter:description" content="Play Fodinha, the classic Brazilian card game, online with friends!" />
        <meta name="twitter:image" content="/og-image.png" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
} 
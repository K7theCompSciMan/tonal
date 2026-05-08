import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tonal",
  description: "Music streaming web app powered by Jamindo and YouTube - made by @k7",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#000000",
};

const appFallbackCss = `
*{box-sizing:border-box}html,body{height:100%;margin:0;background:#000;color:#fff}button,input{font:inherit}button{cursor:pointer}img{display:block;max-width:100%}
.tonal-shell{display:flex;height:100dvh;background:#000;color:#fff;overflow:hidden;font-family:var(--font-geist-sans),ui-sans-serif,system-ui,sans-serif}
.tonal-sidebar{display:none;width:240px;background:#000;padding:8px;flex-direction:column;gap:8px;flex-shrink:0}
.tonal-nav,.tonal-playlists,.tonal-auth-panel{background:#121212;border-radius:8px;padding:16px}
.tonal-nav{display:flex;flex-direction:column;gap:16px}.tonal-nav-button{width:100%;border:0;background:transparent;color:#a7a7a7;text-align:left;font-weight:800;padding:0}.tonal-nav-button.is-active{color:#fff}
.tonal-playlists{flex:1;overflow:auto}.tonal-playlists-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;color:#a7a7a7;font-weight:800}.tonal-icon-button{border:0;background:transparent;color:#a7a7a7;padding:4px 8px;border-radius:6px}.tonal-icon-button:hover{color:#fff;background:#282828}
.tonal-list-button{display:block;width:100%;border:0;background:transparent;color:#fff;text-align:left;padding:10px 8px;border-radius:6px}.tonal-list-button:hover{background:#282828}
.tonal-auth-panel{border:1px solid #282828}.tonal-muted{color:#a7a7a7}.tonal-green{color:#1db954}.tonal-error{color:#f15e6c}.tonal-auth-form{display:flex;flex-direction:column;gap:12px}.tonal-input{width:100%;border:1px solid #333;background:#242424;color:#fff;border-radius:6px;padding:10px 12px;outline:none}.tonal-input:focus{border-color:#fff}.tonal-primary{border:0;background:#1db954;color:#000;border-radius:999px;padding:10px 16px;font-weight:900}.tonal-primary:hover{background:#1ed760}.tonal-secondary{border:1px solid #727272;background:transparent;color:#fff;border-radius:999px;padding:9px 16px;font-weight:800}.tonal-secondary:hover{border-color:#fff}.tonal-link-button{border:0;background:transparent;color:#ddd;font-weight:700;font-size:12px}
.tonal-main{flex:1;margin:0;overflow:auto;padding:calc(68px + env(safe-area-inset-top)) 16px 176px;background:linear-gradient(to bottom,#222,#121212)}
.tonal-mobile-header{position:fixed;left:0;right:0;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #282828;background:rgba(0,0,0,.96);padding:12px 16px}.tonal-brand{border:0;background:transparent;color:#fff;font-size:20px;font-weight:950}.tonal-mobile-actions{display:flex;gap:8px;align-items:center}
.tonal-page-head{display:flex;flex-direction:column;gap:8px;margin-bottom:24px}.tonal-title{font-size:28px;line-height:1.1;margin:0;font-weight:950}.tonal-copy{margin:4px 0 0;color:#a7a7a7;font-size:14px}
.tonal-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.tonal-card{border:0;background:#181818;color:#fff;text-align:left;border-radius:8px;padding:12px;min-width:0}.tonal-card:hover{background:#282828}.tonal-cover{aspect-ratio:1;background:#333;border-radius:6px;margin-bottom:14px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.35)}.tonal-track-title{font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tonal-track-meta{font-size:14px;color:#a7a7a7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tonal-search{width:100%;max-width:576px;background:#242424;color:#fff;border:0;border-radius:999px;padding:13px 16px;outline:none;font-size:16px}.tonal-search:focus{box-shadow:0 0 0 2px #fff}.tonal-results{max-width:768px;display:flex;flex-direction:column;gap:18px}.tonal-search-section{display:flex;flex-direction:column;gap:4px}.tonal-section-heading{margin:4px 0 6px;color:#fff;font-size:15px;font-weight:950}.tonal-row{width:100%;border:0;background:transparent;color:#fff;display:flex;align-items:center;gap:12px;text-align:left;padding:12px;border-radius:6px}.tonal-row:hover{background:rgba(255,255,255,.1)}.tonal-thumb{width:48px;height:48px;background:#3f3f46;border-radius:4px;overflow:hidden;flex-shrink:0}.tonal-min{min-width:0;flex:1}
.tonal-library-head{display:flex;flex-direction:column;gap:12px;margin-bottom:24px}.tonal-library-list{display:flex;flex-direction:column;gap:8px}.tonal-playlist-card{width:100%;border:0;background:#181818;color:#fff;text-align:left;border-radius:8px;padding:16px}.tonal-playlist-card:hover{background:#282828}.tonal-playlist-card-row{display:flex;align-items:center;justify-content:space-between;gap:12px}.tonal-playlist-open{border:0;background:transparent;color:#fff;text-align:left;min-width:0;flex:1;padding:0}.tonal-playlist-quick-actions{display:flex;align-items:center;gap:8px;flex-shrink:0}.tonal-small-round{width:40px;height:40px;border-radius:999px;padding:0;display:inline-flex;align-items:center;justify-content:center}.tonal-icon-only{width:40px;height:40px;border-radius:999px;padding:0;display:inline-flex;align-items:center;justify-content:center}.tonal-icon-text{display:inline-flex;align-items:center;gap:8px}
.tonal-playlist-hero{display:flex;flex-direction:column;gap:18px;margin-bottom:22px}.tonal-playlist-cover{width:156px;aspect-ratio:1;background:linear-gradient(135deg,#333,#111);box-shadow:0 16px 44px rgba(0,0,0,.45);border-radius:6px;display:flex;align-items:center;justify-content:center;overflow:hidden;color:#b3b3b3;font-size:52px}.tonal-playlist-cover img{width:100%;height:100%;object-fit:cover}.tonal-playlist-title{font-size:40px;line-height:1;margin:4px 0 10px;font-weight:950;letter-spacing:0}.tonal-playlist-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:18px}.tonal-round-play{width:52px;height:52px;border-radius:999px;padding:0;display:inline-flex;align-items:center;justify-content:center;font-size:20px}.tonal-empty{background:#181818;border-radius:8px;padding:24px;color:#fff}.tonal-track-list{display:flex;flex-direction:column;gap:2px}.tonal-track-list-head{display:grid;grid-template-columns:36px minmax(0,1fr) 30%;gap:12px;padding:8px 12px;border-bottom:1px solid #282828;color:#b3b3b3;font-size:12px;text-transform:uppercase;letter-spacing:.06em}.tonal-track-list-head span:last-child{text-align:right}.tonal-hide-mobile{display:none}.tonal-track-row{display:flex;align-items:center;gap:8px;border-radius:6px;min-height:60px;padding:4px 8px;color:#fff}.tonal-track-row:hover,.tonal-track-row.is-current{background:rgba(255,255,255,.08)}.tonal-track-main{border:0;background:transparent;color:inherit;display:grid;grid-template-columns:28px 44px minmax(0,1fr);gap:10px;align-items:center;text-align:left;min-width:0;flex:1;padding:4px 0}.tonal-track-index{color:#b3b3b3;text-align:center;font-size:13px}.tonal-track-thumb{width:44px;height:44px}.tonal-track-thumb img{width:100%;height:100%;object-fit:cover}.tonal-more-button{border:0;background:transparent;color:#b3b3b3;border-radius:999px;padding:8px 10px;font-weight:950;letter-spacing:2px}.tonal-more-button:hover{color:#fff;background:#282828}
.tonal-side-panel{display:none}.tonal-overlay{position:fixed;left:0;right:0;top:0;bottom:96px;z-index:40;background:#121212;display:flex;flex-direction:column;padding-top:env(safe-area-inset-top);border-left:1px solid #282828}.tonal-panel-head{display:flex;align-items:center;justify-content:space-between;padding:16px;border-bottom:1px solid #282828}.tonal-panel-body{flex:1;overflow:auto;padding:8px}
.tonal-player{position:fixed;left:0;right:0;bottom:0;z-index:30;height:96px;background:#000;border-top:1px solid #282828;display:flex;align-items:center;gap:8px;padding:10px 12px max(10px,env(safe-area-inset-bottom))}.tonal-player-track{width:32%;min-width:0;display:flex;align-items:center}.tonal-now-button{border:0;background:transparent;color:#fff;display:flex;align-items:center;gap:8px;min-width:0;text-align:left}.tonal-player-art{width:44px;height:44px;background:#1f2937;border-radius:4px;overflow:hidden;flex-shrink:0}.tonal-player-info{display:none;min-width:0}.tonal-controls{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:6px}.tonal-control-row{display:flex;align-items:center;gap:8px}.tonal-control{border:0;background:transparent;color:#b3b3b3;font-size:18px;padding:6px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center}.tonal-control:hover,.tonal-control.is-active{color:#1db954}.tonal-play{width:40px;height:40px;border:0;border-radius:999px;background:#fff;color:#000;font-weight:900}.tonal-progress{display:none;width:100%;max-width:576px;align-items:center;gap:8px;color:#a7a7a7;font-size:11px}.tonal-progress input,.tonal-volume{accent-color:#1db954}.tonal-player-tools{width:32%;display:flex;justify-content:flex-end;align-items:center;gap:4px}.tonal-tool{border:0;background:transparent;color:#a7a7a7;border-radius:6px;padding:8px;font-weight:800}.tonal-tool.is-active,.tonal-tool:hover{color:#1db954}.tonal-tool-label{display:none}.tonal-volume{display:none;width:96px}
.tonal-action-backdrop{position:fixed;inset:0;z-index:55;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center;padding:16px}.tonal-action-sheet{width:min(440px,100%);max-height:calc(100dvh - 120px);overflow:auto;background:#181818;border:1px solid #333;border-radius:12px;padding:12px;box-shadow:0 24px 80px rgba(0,0,0,.6)}.tonal-action-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:4px 4px 12px;border-bottom:1px solid #282828;margin-bottom:8px}.tonal-action-item{width:100%;border:0;background:transparent;color:#fff;text-align:left;padding:12px;border-radius:8px;font-weight:700}.tonal-action-item:hover{background:#282828}.tonal-action-group-title{padding:14px 12px 6px;color:#b3b3b3;font-size:12px;text-transform:uppercase;letter-spacing:.06em;font-weight:900}.tonal-toast{position:fixed;left:50%;bottom:164px;z-index:60;transform:translateX(-50%);background:#fff;color:#000;border-radius:999px;padding:10px 16px;font-weight:800;box-shadow:0 12px 36px rgba(0,0,0,.45);max-width:calc(100vw - 32px);text-align:center}
.mobile-tab-bar{position:fixed;left:0;right:0;bottom:96px;z-index:25;display:flex;align-items:stretch;min-height:52px;background:#000;border-top:1px solid #282828;padding-bottom:env(safe-area-inset-bottom)}.mobile-tab-bar button{border:0;background:transparent}
.tonal-mobile-sheet{position:fixed;inset:0;z-index:50;display:flex;flex-direction:column;background:rgba(0,0,0,.72)}.tonal-sheet-spacer{flex:1;border:0;background:transparent}.tonal-sheet{border-top:1px solid #282828;border-radius:18px 18px 0 0;background:#000;padding:16px max(16px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left))}.tonal-sheet-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
@media (min-width:430px){.tonal-player-info{display:block}.tonal-progress{display:flex}.tonal-shuffle{display:inline-block}}
@media (min-width:640px){.tonal-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.tonal-page-head,.tonal-library-head{flex-direction:row;align-items:flex-end;justify-content:space-between}.tonal-playlist-hero{flex-direction:row;align-items:flex-end}.tonal-hide-mobile{display:block}.tonal-track-list-head{grid-template-columns:36px minmax(0,1fr) 30% 80px}.tonal-tool-label{display:inline-flex}.tonal-volume{display:block}}
@media (min-width:768px){.tonal-sidebar{display:flex}.tonal-main{margin:8px;border-radius:8px;padding:24px 24px 112px}.tonal-mobile-header{display:none}.tonal-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.tonal-card{padding:16px}.tonal-title{font-size:32px}.tonal-player{height:96px;padding:12px 16px}.tonal-player-track,.tonal-player-tools{width:30%}}
@media (min-width:1024px){.tonal-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.tonal-playlist-title{font-size:64px}.tonal-side-panel{display:flex;width:340px;flex-shrink:0;background:#121212;margin:8px 8px 8px 0;border:1px solid #282828;border-radius:8px;overflow:hidden;flex-direction:column}.tonal-overlay{inset:auto;top:0;right:0;bottom:96px;width:380px}}
@media (min-width:1280px){.tonal-grid{grid-template-columns:repeat(5,minmax(0,1fr))}}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <style dangerouslySetInnerHTML={{ __html: appFallbackCss }} />
      </head>
      <body
        className={`${geistSans.className} min-h-dvh flex flex-col bg-black text-white antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

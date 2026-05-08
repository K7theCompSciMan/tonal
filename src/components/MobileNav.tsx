'use client';
// src/components/MobileNav.tsx — bottom tab bar for mobile

interface Tab {
  id: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
  href?: string;
  onClick?: () => void;
}

interface Props {
  activeTab: string;
  onTabChange: (tab: string) => void;
  hasNowPlaying: boolean;
  onNowPlayingClick: () => void;
}

export default function MobileNav({ activeTab, onTabChange, hasNowPlaying, onNowPlayingClick }: Props) {
  const tabs: Tab[] = [
    {
      id: 'home',
      label: 'Home',
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'white' : '#B3B3B3'}>
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
        </svg>
      ),
    },
    {
      id: 'search',
      label: 'Search',
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'white' : '#B3B3B3'}>
          <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        </svg>
      ),
    },
    {
      id: 'library',
      label: 'Library',
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'white' : '#B3B3B3'}>
          <path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 5h-3v5.5a2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1 2.5-2.5c.57 0 1.08.19 1.5.51V5h4v2zm-13 2H3c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2v-2h-2v2H3V11h2V9z"/>
        </svg>
      ),
    },
  ];

  return (
    <nav className="mobile-tab-bar md:hidden">
      {tabs.map(tab => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-opacity active:opacity-60"
            style={{ color: active ? 'white' : '#B3B3B3' }}
          >
            {tab.icon(active)}
            {tab.label}
          </button>
        );
      })}

      {/* Now playing mini-tab */}
      {hasNowPlaying && (
        <button
          onClick={onNowPlayingClick}
          className="flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium"
          style={{ color: activeTab === 'nowplaying' ? 'white' : '#B3B3B3' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
          </svg>
          Playing
        </button>
      )}
    </nav>
  );
}
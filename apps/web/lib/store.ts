import { create } from 'zustand';

export type RightRegion = 'sidebar' | 'empty';

interface UiState {
  rightRegion: RightRegion;
  leftRailOpen: boolean;
  leftRailWidth: number;
  sidebarWidth: number;
  viewerWidth: number;
  viewerOpen: boolean;
  viewerExpanded: boolean;
  activeId: string;
  fbName: string;
  progressOpen: boolean;
  activeSheet: string;
  activeSlide: number;
  docPage: number;
  accepted: Record<string, boolean>;
  discarded: Record<string, boolean>;
  modelMenuOpen: boolean;
  providerDialogOpen: boolean;
  activeModel: string;
  providersConnected: Record<string, boolean>;

  toggleSidebar: () => void;
  toggleLeftRail: () => void;
  setLeftRailWidth: (w: number) => void;
  setSidebarWidth: (w: number) => void;
  setViewerWidth: (w: number) => void;
  toggleProgress: () => void;
  openViewer: (id: string, name?: string) => void;
  closeViewer: () => void;
  toggleExpand: () => void;
  switchFile: (id: string) => void;
  setSheet: (k: string) => void;
  setSlide: (i: number) => void;
  acceptFile: () => void;
  undoFile: () => void;
  toggleModelMenu: () => void;
  closeModelMenu: () => void;
  pickModel: (id: string) => void;
  openProviderDialog: () => void;
  closeProviderDialog: () => void;
  toggleProvider: (id: string) => void;
  pageStep: (d: number, pageCount: number) => void;
}

export const useUiStore = create<UiState>((set) => ({
  rightRegion: 'sidebar',
  leftRailOpen: true,
  leftRailWidth: 284,
  sidebarWidth: 376,
  viewerWidth: 648,
  viewerOpen: false,
  viewerExpanded: false,
  activeId: 'docx',
  fbName: 'file.bin',
  progressOpen: true,
  activeSheet: 'summary',
  activeSlide: 0,
  docPage: 1,
  accepted: {},
  discarded: {},
  modelMenuOpen: false,
  providerDialogOpen: false,
  activeModel: 'pro-max',
  providersConnected: { openoffice: true },

  toggleSidebar: () =>
    set((s) => ({
      rightRegion: s.rightRegion === 'sidebar' ? 'empty' : 'sidebar',
    })),
  toggleLeftRail: () => set((s) => ({ leftRailOpen: !s.leftRailOpen })),
  setLeftRailWidth: (w) => set({ leftRailWidth: w }),
  setSidebarWidth: (w) => set({ sidebarWidth: w }),
  setViewerWidth: (w) => set({ viewerWidth: w }),
  toggleProgress: () => set((s) => ({ progressOpen: !s.progressOpen })),
  openViewer: (id, name) =>
    set({
      viewerOpen: true,
      activeId: id,
      fbName: name ?? 'file.bin',
      docPage: 1,
      activeSheet: 'summary',
      activeSlide: 0,
    }),
  closeViewer: () => set({ viewerOpen: false }),
  toggleExpand: () => set((s) => ({ viewerExpanded: !s.viewerExpanded })),
  switchFile: (id) => set({ activeId: id, docPage: 1 }),
  setSheet: (k) => set({ activeSheet: k }),
  setSlide: (i) => set({ activeSlide: i }),
  acceptFile: () => set((s) => ({ accepted: { ...s.accepted, [s.activeId]: true } })),
  undoFile: () =>
    set((s) => ({
      discarded: { ...s.discarded, [s.activeId]: true },
      viewerOpen: false,
    })),
  toggleModelMenu: () => set((s) => ({ modelMenuOpen: !s.modelMenuOpen })),
  closeModelMenu: () => set({ modelMenuOpen: false }),
  pickModel: (id) => set({ activeModel: id, modelMenuOpen: false }),
  openProviderDialog: () => set({ providerDialogOpen: true, modelMenuOpen: false }),
  closeProviderDialog: () => set({ providerDialogOpen: false }),
  toggleProvider: (id) => {
    if (id === 'openoffice') return;
    set((s) => ({
      providersConnected: {
        ...s.providersConnected,
        [id]: !s.providersConnected[id],
      },
    }));
  },
  pageStep: (d, pageCount) =>
    set((s) => ({ docPage: Math.min(pageCount, Math.max(1, s.docPage + d)) })),
}));

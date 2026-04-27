export type DownloadStatus = 'downloading' | 'paused' | 'queued' | 'complete' | 'failed';
export type DownloadKind = 'http' | 'torrent';

export interface Download {
  id: string;
  kind: DownloadKind;
  name: string;
  ext: string;
  sizeBytes: number;
  downloadedBytes: number;
  progress: number;
  speedBps: number;
  etaSeconds: number;
  status: DownloadStatus;
  source: string;
  completedAt?: string;
  folder?: string;
  url?: string;
  errorMessage?: string;
}

export interface DownloadCreateRequest {
  url: string;
  folder?: string;
  segments?: number;
  username?: string;
  password?: string;
  mirrors?: string[];
  checksumAlgo?: string;
  checksumExpected?: string;
  referer?: string;
  cookies?: string;
  userAgent?: string;
  filename?: string;
  sizeBytes?: number;
  acceptsRanges?: boolean;
  probe?: boolean;
  overwrite?: boolean;
}

export interface BatchDownloadRequest {
  urls?: string[];
  pattern?: string;
  folder?: string;
  segments?: number;
  username?: string;
  password?: string;
}

export interface TorrentCreateRequest {
  magnet?: string;
  torrentUrl?: string;
  torrentBase64?: string;
  folder?: string;
  name?: string;
  overwrite?: boolean;
}

export interface DownloadPreview {
  id: string;
  kind: DownloadKind;
  name: string;
  source: string;
  url: string;
  folder: string;
  sizeBytes: number;
  acceptsRanges: boolean;
  segments: number;
  http?: DownloadCreateRequest;
  torrent?: TorrentCreateRequest;
  targetExists?: boolean;
}

export interface ScheduleRule {
  id?: number;
  cronStart?: string;
  cronPause?: string;
  enabled: boolean;
  label?: string;
  shutdownAfter?: boolean;
  rateLimitKbps?: number;
}

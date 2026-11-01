// The soundtrack: looping MP3s in assets/audio/music/ (rendered by scripts/music/gen.mjs from scripts/music/songs.mjs)
// with their loop points in seconds in tracks.json (loopEnd 0 = play once).
import tracks from '../../assets/audio/music/tracks.json';

export type TrackId = keyof typeof tracks;
export const TRACKS: Record<TrackId, { loopStart: number; loopEnd: number }> = tracks;
/** The track's file under assets/. */
export const trackFile = (id: TrackId): string => `audio/music/${id}.mp3`;

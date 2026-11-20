import { supabase } from "@/integrations/supabase/client";

export const MAX_MUSIC_FILE_BYTES = 50 * 1024 * 1024;
export const MUSIC_ACCEPT = ".mp3,.wav,.m4a,.aac,.ogg,.flac,.webm,audio/*";
const MUSIC_EXTENSIONS = new Set(["mp3", "wav", "m4a", "aac", "ogg", "flac", "webm"]);

export type UploadedSong = {
  id: string;
  title: string;
  artist: string;
  file_path: string;
  mime_type: string;
  size_bytes: number;
  favorite: boolean;
  created_at: string;
};

export function musicExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function musicTitle(name: string): string {
  const extension = musicExtension(name);
  const withoutExtension = extension ? name.slice(0, -(extension.length + 1)) : name;
  return withoutExtension.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim() || "Untitled song";
}

export function validateMusicFile(file: Pick<File, "name" | "size">): string | null {
  if (!MUSIC_EXTENSIONS.has(musicExtension(file.name)))
    return "Choose an MP3, WAV, M4A, AAC, OGG, FLAC or WebM audio file.";
  if (file.size === 0) return "That audio file is empty.";
  if (file.size > MAX_MUSIC_FILE_BYTES) return "Each song must be 50 MB or smaller.";
  return null;
}

export function musicStoragePath(userId: string, name: string, id: string): string {
  return `${userId}/${id}.${musicExtension(name)}`;
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Sign in to upload your music.");
  return data.user.id;
}

export async function loadUploadedSongs(): Promise<UploadedSong[]> {
  const { data, error } = await supabase
    .from("uploaded_songs")
    .select("id, title, artist, file_path, mime_type, size_bytes, favorite, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Couldn't load your music. Please try again.");
  return data ?? [];
}

export async function uploadMusic(file: File): Promise<UploadedSong> {
  const validationError = validateMusicFile(file);
  if (validationError) throw new Error(validationError);
  const userId = await requireUserId();
  const path = musicStoragePath(userId, file.name, crypto.randomUUID());
  const { error: uploadError } = await supabase.storage.from("user-music").upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (uploadError) throw new Error("Couldn't upload this song. Please try again.");

  const { data, error } = await supabase
    .from("uploaded_songs")
    .insert({
      user_id: userId,
      title: musicTitle(file.name),
      file_path: path,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
    })
    .select("id, title, artist, file_path, mime_type, size_bytes, favorite, created_at")
    .single();
  if (error) {
    await supabase.storage.from("user-music").remove([path]);
    throw new Error("The song uploaded, but couldn't be added to your library. Please try again.");
  }
  return data;
}

export async function uploadedSongUrl(song: UploadedSong): Promise<string> {
  const { data, error } = await supabase.storage
    .from("user-music")
    .createSignedUrl(song.file_path, 3600);
  if (error) throw new Error("Couldn't open this song. Please try again.");
  return data.signedUrl;
}

export async function favoriteUploadedSong(id: string, favorite: boolean): Promise<void> {
  const { error } = await supabase.from("uploaded_songs").update({ favorite }).eq("id", id);
  if (error) throw new Error("Couldn't update this favorite. Please try again.");
}

export async function deleteUploadedSong(song: UploadedSong): Promise<void> {
  const { error: fileError } = await supabase.storage.from("user-music").remove([song.file_path]);
  if (fileError) throw new Error("Couldn't delete this song. Please try again.");
  const { error } = await supabase.from("uploaded_songs").delete().eq("id", song.id);
  if (error)
    throw new Error("The file was removed, but its library entry remains. Please try again.");
}

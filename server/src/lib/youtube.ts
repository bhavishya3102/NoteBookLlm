/**
 * YouTube transcript extraction for YOUTUBE source imports.
 */

import {
    YoutubeTranscript,
    YoutubeTranscriptDisabledError,
    YoutubeTranscriptNotAvailableError,
    YoutubeTranscriptTooManyRequestError,
    YoutubeTranscriptVideoUnavailableError,
} from "youtube-transcript";
import { ValidationError } from "../types/app-error.js";

/**
 * Matches every YouTube URL shape we accept: watch (with the `v` param in any
 * position), youtu.be, embed, shorts, and live.
 */
const YOUTUBE_VIDEO_ID =
    /(?:youtube\.com\/(?:(?:v|e|embed|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([\w-]{11})/;

/**
 * Extracts the 11-character video id from a YouTube URL or a bare id.
 *
 * @param url - YouTube page URL, or the video id itself
 * @returns Video id, or null when the input is not a YouTube video
 */
function extractVideoId(url: string) {
    if (/^[\w-]{11}$/.test(url)) {
        return url;
    }

    return url.match(YOUTUBE_VIDEO_ID)?.[1] ?? null;
}

/**
 * Fetches caption transcript text for a YouTube video.
 *
 * @param url - YouTube page URL
 * @returns Video id and concatenated transcript text
 * @throws {ValidationError} When the URL is invalid, captions are missing, or fetch fails
 *
 *
 */
export async function fetchYoutubeTranscript(url: string) {
    const videoId = extractVideoId(url);

    if (!videoId) {
        throw new ValidationError("Enter a valid YouTube URL");
    }

    let segments;

    try {
        segments = await YoutubeTranscript.fetchTranscript(videoId);
    } catch (error) {
        console.error("[youtube] transcript fetch failed", videoId, error);

        if (error instanceof YoutubeTranscriptTooManyRequestError) {
            throw new ValidationError(
                "YouTube is rate limiting this server. Try again in a few minutes.",
            );
        }

        if (error instanceof YoutubeTranscriptVideoUnavailableError) {
            throw new ValidationError(
                "This video is unavailable, private, or does not exist.",
            );
        }

        if (
            error instanceof YoutubeTranscriptDisabledError ||
            error instanceof YoutubeTranscriptNotAvailableError
        ) {
            throw new ValidationError(
                "No transcript available for this video. Captions may be turned off, or the video may be private or removed.",
            );
        }

        throw new ValidationError(
            "Could not fetch transcript. The video may not have captions.",
        );
    }

    const content = segments
        .map((segment) => segment.text)
        .join(" ")
        .trim();

    if (!content) {
        console.error("[youtube] empty transcript", videoId, segments.length);
        throw new ValidationError(
            "No transcript available for this video. Captions may be turned off, or the video may be private or removed.",
        );
    }

    return { videoId, content };
}

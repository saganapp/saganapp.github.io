import type { MetadataEvent } from "../types";
import { makeSpotifyEvent } from "./utils";

interface FollowData {
  userIsFollowing?: string[];
  userIsFollowedBy?: string[];
  userIsBlocking?: string[];
}

export function parseFollow(data: FollowData): MetadataEvent[] {
  const following = data.userIsFollowing ?? [];
  const followers = data.userIsFollowedBy ?? [];

  const followingCount = following.length;
  const followerCount = followers.length;
  const followRatio =
    followerCount > 0
      ? Math.round((followingCount / followerCount) * 100) / 100
      : followingCount > 0
        ? Infinity
        : 0;

  return [
    makeSpotifyEvent("profile_update", new Date(), "You", [], {
      subSource: "follow",
      followingCount,
      followerCount,
      followRatio,
      following,
      followers,
    }),
  ];
}

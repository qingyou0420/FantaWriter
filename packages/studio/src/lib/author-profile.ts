/**
 * Browser-safe author profile types and limits.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export const AUTHOR_NAME_MAX = 24;
export const AUTHOR_BIO_MAX = 300;
export const AUTHOR_AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AUTHOR_AVATAR_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export interface AuthorProfile {
  readonly name: string;
  readonly bio: string;
  readonly avatarPath?: string;
  readonly updatedAt: string;
}

export interface AuthorPublic {
  readonly name: string;
  readonly bio: string;
  readonly avatarPath?: string;
  readonly updatedAt?: string;
  readonly hasAvatar: boolean;
}

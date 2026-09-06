/**
 * Persist author profile under the explicit project root.
 * Path: `.inkos/author.json` + `.inkos/author/avatar.<ext>`.
 * Never use process.cwd().
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import {
  AUTHOR_AVATAR_MAX_BYTES,
  AUTHOR_AVATAR_TYPES,
  AUTHOR_BIO_MAX,
  AUTHOR_NAME_MAX,
  type AuthorProfile,
  type AuthorPublic,
} from "./author-profile.js";

export {
  AUTHOR_AVATAR_MAX_BYTES,
  AUTHOR_AVATAR_TYPES,
  AUTHOR_BIO_MAX,
  AUTHOR_NAME_MAX,
  type AuthorProfile,
  type AuthorPublic,
} from "./author-profile.js";

const EMPTY: AuthorProfile = { name: "", bio: "", updatedAt: "" };

function authorDir(root: string): string {
  return join(root, ".inkos");
}

function authorJsonPath(root: string): string {
  return join(authorDir(root), "author.json");
}

function authorAvatarDir(root: string): string {
  return join(authorDir(root), "author");
}

export function parseAuthorProfile(raw: unknown): AuthorProfile {
  if (!raw || typeof raw !== "object") return EMPTY;
  const body = raw as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name : "";
  const bio = typeof body.bio === "string" ? body.bio : "";
  const avatarPath = typeof body.avatarPath === "string" && body.avatarPath.trim()
    ? body.avatarPath.trim()
    : undefined;
  const updatedAt = typeof body.updatedAt === "string" ? body.updatedAt : "";
  return { name, bio, avatarPath, updatedAt };
}

export function normalizeAuthorPatch(input: {
  readonly name?: unknown;
  readonly bio?: unknown;
}): { readonly name?: string; readonly bio?: string } | { readonly error: string } {
  const patch: { name?: string; bio?: string } = {};
  if (input.name !== undefined) {
    if (typeof input.name !== "string") return { error: "作者名必须是文字" };
    const name = input.name.trim();
    if (name.length > AUTHOR_NAME_MAX) return { error: `作者名最多 ${AUTHOR_NAME_MAX} 字` };
    patch.name = name;
  }
  if (input.bio !== undefined) {
    if (typeof input.bio !== "string") return { error: "简介必须是文字" };
    if (input.bio.length > AUTHOR_BIO_MAX) return { error: `简介最多 ${AUTHOR_BIO_MAX} 字` };
    patch.bio = input.bio;
  }
  return patch;
}

export function toAuthorPublic(profile: AuthorProfile): AuthorPublic {
  return {
    name: profile.name,
    bio: profile.bio,
    avatarPath: profile.avatarPath,
    updatedAt: profile.updatedAt || undefined,
    hasAvatar: Boolean(profile.avatarPath),
  };
}

export async function loadAuthorProfile(root: string): Promise<AuthorProfile> {
  try {
    const raw = await readFile(authorJsonPath(root), "utf-8");
    return parseAuthorProfile(JSON.parse(raw) as unknown);
  } catch {
    return EMPTY;
  }
}

export async function saveAuthorProfile(
  root: string,
  next: AuthorProfile,
): Promise<AuthorProfile> {
  await mkdir(authorDir(root), { recursive: true });
  const profile: AuthorProfile = {
    name: next.name,
    bio: next.bio,
    ...(next.avatarPath ? { avatarPath: next.avatarPath } : {}),
    updatedAt: next.updatedAt,
  };
  await writeFile(authorJsonPath(root), `${JSON.stringify(profile, null, 2)}\n`, "utf-8");
  return profile;
}

export function avatarExtensionFor(mime: string, filename = ""): string {
  if (mime === "image/png" || extname(filename).toLowerCase() === ".png") return "png";
  if (mime === "image/webp" || extname(filename).toLowerCase() === ".webp") return "webp";
  return "jpg";
}

export function avatarContentType(ext: string): string {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

export async function saveAuthorAvatar(
  root: string,
  bytes: Uint8Array,
  mime: string,
  filename = "",
): Promise<AuthorProfile> {
  if (!AUTHOR_AVATAR_TYPES.has(mime)) {
    throw new Error("头像只支持 png / jpg / webp");
  }
  if (bytes.byteLength > AUTHOR_AVATAR_MAX_BYTES) {
    throw new Error("头像不能超过 2 MB");
  }
  const ext = avatarExtensionFor(mime, filename);
  const relative = `.inkos/author/avatar.${ext}`;
  await mkdir(authorAvatarDir(root), { recursive: true });
  await writeFile(join(root, relative), bytes);
  const current = await loadAuthorProfile(root);
  return saveAuthorProfile(root, {
    ...current,
    avatarPath: relative,
    updatedAt: new Date().toISOString(),
  });
}

export async function clearAuthorAvatar(root: string): Promise<AuthorProfile> {
  const current = await loadAuthorProfile(root);
  if (current.avatarPath) {
    await rm(join(root, current.avatarPath), { force: true });
  }
  return saveAuthorProfile(root, {
    name: current.name,
    bio: current.bio,
    updatedAt: new Date().toISOString(),
  });
}

export async function readAuthorAvatar(
  root: string,
): Promise<{ readonly bytes: Uint8Array; readonly contentType: string } | null> {
  const profile = await loadAuthorProfile(root);
  if (!profile.avatarPath) return null;
  try {
    const bytes = await readFile(join(root, profile.avatarPath));
    const ext = extname(profile.avatarPath).replace(".", "").toLowerCase();
    return { bytes, contentType: avatarContentType(ext) };
  } catch {
    return null;
  }
}

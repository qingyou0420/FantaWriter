/**
 * Studio re-export of the shared volume_map tree. G1 still requires a real
 * chapter entry; the parser does not invent one.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export {
  applyOutlineWorkspaceSave,
  applyVolumeMapNodeEdit,
  buildOutlineEditPatch,
  findChapterNode,
  findNodeById,
  findVolumeForChapter,
  formatVolumeLabel,
  insertChapterStub,
  lastPlannedChapter,
  lockedNamedVolumeCount,
  HARD_CHAPTER_TITLE_CHARS,
  MAX_CHAPTER_TITLE_CHARS,
  MAX_VOLUME_TREE_LABEL_CHARS,
  chapterTitleLimit,
  normalizeVolumeMapChapterHeadings,
  outlineEditorSource,
  parseChineseInt,
  nextUnfilledChapterBatch,
  parseVolumeMapTree,
  plannedChapterCount,
  resolveOutlineWeaveStep,
  splitOutlineTitleAndSummary,
  tidyVolumeMapMarkdown,
  volumeMapHasLockedVolumes,
  volumeMapHasLockedNamedVolumes,
  recommendedOutlineNodeId,
  truncateOutlineLabel,
  volumeContainsChapter,
  type OutlineWeaveStep,
  type VolumeMapChapterNode,
  type VolumeMapNodeKind,
  type VolumeMapNoteNode,
  type VolumeMapTree,
  type VolumeMapVolumeNode,
} from "@actalk/inkos-core/volume-map-tree";

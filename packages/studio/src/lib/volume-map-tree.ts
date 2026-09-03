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
  MAX_VOLUME_TREE_LABEL_CHARS,
  outlineEditorSource,
  parseChineseInt,
  parseVolumeMapTree,
  plannedChapterCount,
  recommendedOutlineNodeId,
  truncateOutlineLabel,
  volumeContainsChapter,
  type VolumeMapChapterNode,
  type VolumeMapNodeKind,
  type VolumeMapTree,
  type VolumeMapVolumeNode,
} from "@actalk/inkos-core";

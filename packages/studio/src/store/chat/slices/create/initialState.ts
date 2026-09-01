import type { CreateState } from "../../types";

export const initialCreateState: CreateState = {
  bookDataVersion: 0,
  sidebarView: "panel",
  artifactFile: null,
  artifactChapter: null,
  projectArtifactPath: null,
  bookSummary: null,
  resolvedProposals: {},
};

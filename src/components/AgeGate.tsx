"use client";

export function AgeGate({
  onConfirm,
  onRefuse,
}: {
  onConfirm: () => void;
  onRefuse: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="age-gate-title">
      <div className="modal-card">
        <h2 id="age-gate-title" className="text-base font-semibold m-0 mb-2">
          确认已满 18 岁
        </h2>
        <p className="text-sm text-[var(--text-muted)] leading-relaxed m-0 mb-4">
          色情写作台仅用于成年角色（18+）的虚构创作。确认后本机记住这次选择，下次打开不再询问。拒绝则只显示常规写作台，已有作品不会删除。
        </p>
        <div className="flex gap-2 justify-end">
          <button type="button" className="btn btn-ghost" onClick={onRefuse}>
            只用常规
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            我已满 18 岁
          </button>
        </div>
      </div>
    </div>
  );
}

export function FirstBoardChooser({
  onGeneral,
  onErotic,
}: {
  onGeneral: () => void;
  onErotic: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="first-board-title">
      <div className="modal-card">
        <h2 id="first-board-title" className="text-base font-semibold m-0 mb-2">
          选择写作台
        </h2>
        <p className="text-sm text-[var(--text-muted)] leading-relaxed m-0 mb-4">
          常规与色情共用编辑器，提示词、标签库和默认工作流互相隔离。可随时在首页切换。
        </p>
        <div className="flex flex-col gap-2">
          <button type="button" className="btn btn-secondary" onClick={onGeneral}>
            常规小说（类型 / 文学）
          </button>
          <button type="button" className="btn btn-primary" onClick={onErotic}>
            色情小说（18+）
          </button>
        </div>
      </div>
    </div>
  );
}

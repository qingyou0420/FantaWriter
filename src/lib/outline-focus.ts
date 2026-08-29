/** 过卷向导只在「刚刚打开」时定位到卷，项目更新不得再拽选中态。 */
export function shouldSnapToWizardVolume(
  prevWizardId: string | null | undefined,
  nextWizardId: string | null | undefined
): boolean {
  return Boolean(nextWizardId && nextWizardId !== prevWizardId);
}

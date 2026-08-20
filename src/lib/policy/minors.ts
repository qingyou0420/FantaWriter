export const MINOR_RE =
  /未成年|未满十八|未满\s*18|17\s*岁|16\s*岁|15\s*岁|14\s*岁|13\s*岁|儿童|幼女|幼男|萝莉|正太|小学生|初中生/;

export const SEX_RE =
  /性交|做爱|插入|口交|肛交|性爱|性行为|强奸|迷奸|乱伦|色情|情色戏|床戏细节/;

export function deniesMinorSexualContent(text: string): boolean {
  return MINOR_RE.test(text) && SEX_RE.test(text);
}

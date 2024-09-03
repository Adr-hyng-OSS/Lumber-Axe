type PartialParts<b,thisArg = b> = {
  [P in keyof b]?: b[P] extends (...param: infer param)=>infer ret?((this: thisArg,...param:param)=>ret):b[P]
};
export function OverTakes<b extends object>(prototype: b, object: PartialParts<b, b>): b{
  const prototypeOrigin = Object.setPrototypeOf(Object.defineProperties({},Object.getOwnPropertyDescriptors(prototype)),Object.getPrototypeOf(prototype));
  Object.setPrototypeOf(object, prototypeOrigin);
  Object.defineProperties(prototype, Object.getOwnPropertyDescriptors(object));
  return prototypeOrigin;
}
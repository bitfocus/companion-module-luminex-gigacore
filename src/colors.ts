import { combineRgb } from '@companion-module/base'

export const White = combineRgb(255, 255, 255)
export const Black = combineRgb(0, 0, 0)
export const Red = combineRgb(200, 0, 0)
export const Yellow = combineRgb(255, 255, 204)
export const Green = combineRgb(0, 200, 0)
export const Orange = combineRgb(255, 102, 0)
export const LightGreen = combineRgb(0, 255, 155)
export const LightBlue = combineRgb(0, 255, 255)
export const Grey = combineRgb(42, 42, 42)

export function hexToColor(val: string): number {
	const res = parseInt(val.substring(1), 16)
	return res
}

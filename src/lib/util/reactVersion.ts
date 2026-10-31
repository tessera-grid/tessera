import { version } from 'react'

/** Мажорная версия React приложения (ADR 0091): часть API в 18 и 19 различается. */
export const REACT_MAJOR = Number(version.split('.')[0])

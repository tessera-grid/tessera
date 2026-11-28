// Адрес истории в Storybook рядом с сайтом: `<base>storybook/?path=/story/<id>` (ADR 0113, DC11).

export const STORYBOOK_DIR = 'storybook'

export const storyUrl = (base, id) =>
  `${base.endsWith('/') ? base : `${base}/`}${STORYBOOK_DIR}/?path=/story/${id}`

import { docsLoader } from '@astrojs/starlight/loaders'
import { docsSchema } from '@astrojs/starlight/schema'
import { defineCollection } from 'astro:content'
import { z } from 'astro/zod'

// Свои поля frontmatter (ADR 0113): `revision` пары страниц (DC3), `notApplicable` —
// раздел шаблона фичи, которого у неё нет, с причиной (DC6).
export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        revision: z.number().int().positive().optional(),
        notApplicable: z.record(z.string(), z.string()).optional(),
      }),
    }),
  }),
}

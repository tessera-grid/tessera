import type { ExportData } from './types'
import { buildXlsx, type BuildXlsxOptions } from './xlsxBuild'

type Request =
  | { data: ExportData; options: BuildXlsxOptions }
  | { rows: ExportData['rows']; last: boolean }

let snapshot: ExportData
let options: BuildXlsxOptions

self.onmessage = async ({ data: request }: MessageEvent<Request>) => {
  try {
    if ('data' in request) {
      snapshot = request.data
      options = request.options
    } else {
      snapshot.rows.push(...request.rows)
      if (request.last) {
        self.postMessage(await buildXlsx(snapshot, options))
        return
      }
    }
    self.postMessage(true)
  } catch {
    self.postMessage(false)
  }
}

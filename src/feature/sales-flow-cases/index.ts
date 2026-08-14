import 'server-only'

export type {
  SalesFlowCase,
  SalesFlowCaseInput,
  SalesFlowReason,
} from './domain/sales-flow-case'
export {
  salesFlowReasonLabels,
  salesFlowReasons,
} from './domain/sales-flow-case'
export { salesFlowCaseInputSchema } from './application/sales-flow-case-service'

import {
  findSalesFlowCase,
  listSalesFlowCases,
  saveSalesFlowCase,
  setSalesFlowCaseEnabled,
} from './application/sales-flow-case-service'

export const salesFlowCasesFeature = {
  listSalesFlowCases,
  saveSalesFlowCase,
  setSalesFlowCaseEnabled,
  findSalesFlowCase,
} as const

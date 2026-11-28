export interface FailureProps {
  /**
   * The wait ended in a failure: the arc stops and fades (ADR 0127). The button has no failure
   * mark — the failure shows on the action's object and in the failure registry (ADR 0177, §2).
   */
  failed?: boolean
}

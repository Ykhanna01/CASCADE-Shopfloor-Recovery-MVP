# CASCADE Phase 2 audit

## Scope and live reference

Inspected the existing domain engine, Postgres state store, REST routes, MCP adapter, OpenAPI contract, domain tests, and current React/Vite interface. The existing MCP endpoint and all eight tools are retained.

The live reference scenario was run through `/api/mcp` using Streamable HTTP. It produced a two-day plywood delay, five exposed orders, three alternatives, an approval rejection before approval, one approved execution, successful verification, and an identical retry. An independent check of the final persisted state found 5 on-time and 3 late orders, sufficient modeled plywood, valid task dependencies, and no machine-day capacity overloads. This confirms the reference fixture; it does not prove the planner enforces those constraints for other schedules.

## Findings

### Preserved behavior that passed

- The shop state is persisted as a JSONB row in `cascade_state`; state mutations use a transaction and row lock.
- The MCP and REST entry points dispatch through the same CASCADE tool operations.
- Approval is required before execution. A live unapproved call returned the expected tool error without changing stock or the schedule.
- Repeating an executed plan is safe; the live retry left one execution event in the audit history.
- On the reference schedule, the approved partial-buy plan’s forecast of 5 on-time and 3 late orders matched the persisted order statuses and dates.

### Recovery-engine defects

1. **The plan results are only partly evaluated from constraints.** The expedite option reports every order on time without simulating a replacement schedule. The wait option derives late counts from the exposed-order count rather than evaluating a material-feasible schedule. The partial-buy option derives dates from a fixed per-order date pattern.
2. **Scheduling is not capacity-aware.** The partial-buy schedule assigns three dates to each affected order based on due-date order and list position. It does not reserve machine hours, test machine-day capacity, preserve collisions with unchanged commitments, or search for another feasible slot. The reference schedule happens not to overload its machines.
3. **Execution and verification trust forecast metadata.** Execution repeats the date heuristic and assigns late statuses from the plan’s `affectedOrders`, rather than deriving them from the resulting task dates. Verification compares only the count of on-time and late order statuses with the plan’s predicted counts; it does not independently check inventory, task dependencies, capacity, or due dates.
4. **“Recommended” is not currently a decision made by the engine.** The local-buy option’s `$470` is computed from modeled components—one local sheet at `$110`, `$60` overtime/rescheduling, and three `$100` late penalties. Its lower total than the `$520` expedite option explains a cost trade-off, but no explicit objective says how to value lateness against cost, and the application does not establish that the local-buy plan was recommended rather than selected by a user.
5. **The plan’s affected-order field is narrower than its schedule changes.** It lists only the three orders forecast late, while the action says four exposed orders are re-sequenced; Rivera’s tasks move but its order remains on time.

### Interface refresh defect

Impact analysis is computed by the API, not persisted. On page load, the UI loads the persisted disruption and plans but initializes its local `impact` state as empty. As a result, refreshing a completed scenario displays zero affected orders/tasks and disables plan comparison until the user manually recalculates impact. It also does not select a persisted plan for the detail panel. This was reproduced in the running preview.

## Decision needed before implementation

The API workflow runs a prebuilt bundle (`dev` builds before starting the server); it does not hot-reload domain changes. The brief prohibits restarting the project and rebuilding the MCP server, but applying and validating recovery-engine changes through the live MCP endpoint requires rebuilding the API bundle and restarting that managed API process. No backend changes have been made in this audit.

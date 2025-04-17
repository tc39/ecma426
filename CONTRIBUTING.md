# TC39-TG3: Source Maps Contribution Guide

Thanks for helping out in the [source map effort](https://ecma-international.org/task-groups/tc39-tg4/). The following guide is meant to help you get to know our workstreams, meetings, and plans.

## Joining Us!

1. We are a TC39 task group! To contribute, you'll need to be added either as a TC39 delegate or an invited expert. If you are already a delegate, you can find our meetings on the TC39 calendar. If you're interested in becoming a delegate, or would like to be added as an invited expert, join our [Matrix room](https://matrix.to/#/#tc39-tg4:matrix.org) and message `jkup` (`@jkup:matrix.org`).
2. We use Matrix for our chat rooms. You can find our main room here: https://matrix.to/#/#tc39-tg4:matrix.org

## Documents

- [Specification Repository](https://github.com/tc39/source-map-spec)
- [RFC discussions](https://github.com/tc39/source-map-rfc)
- [Our website](https://source-map.github.io/)
- [Source map validator (very much work in progress)](https://github.com/jkup/source-map-validator)
- [Stacktrace validator (very much work in progress)](https://github.com/jkup/source-map-stacktrace-validator)

## Workstreams

- **Meetings**. We currently have 2 different recurring meetings.
  - Public feature meeting. Open to all TC39 delegates, this is where we talk about new features we'd like to add to the specification. They can be found under the [naming](https://github.com/tc39/source-map-rfc/issues?q=is%3Aopen+is%3Aissue+label%3A%22Workstream%3A+Naming%22) label on GitHub.
  - Public general meeting. Open to all TC39 delegates, this is where we talk about errors or vague bits of the specification. We discuss issues found under the [correctness](https://github.com/tc39/source-map-rfc/issues?q=is%3Aopen+is%3Aissue+label%3A%22Workstream%3A+Correctness%22+) label on GitHub.
- **Testing**. We're still early stages but this is one of the most important things to focus on. When we present our updates to the [main TC39 plenary](https://github.com/tc39/agendas#agendas), we need to have browsers and tools using these tests in accordance with our [process document](https://github.com/tc39/source-map-rfc/blob/main/PROCESS.md).

## Constituencies

We've been thinking about _source map constituencies_ in the following terms. Please feel free to suggest better titles or categorization methods!

1. Generators. Bundlers, transpilers, compilers. Tools that have access to the source code and emit (among other things) source maps.
2. Debuggers. Browsers, [standalone debuggers](https://www.replay.io/) and stack trace rewriters like [Node](https://nodejs.org/en) and [Sentry](https://sentry.io/).

When considering changes, this list of tools might be useful: https://github.com/jkup/source-map-users

## Testing

We've been categorizing our testing efforts into two groups, each matching with a [constituency](#constituencies).

1. Validators. For testing generator tools, we'd like to have the ability to validate a source map on its own as well as a source map being a valid map between a source and a generated file. We did a mini hackathon day on what this might look like: https://github.com/jkup/source-map-validator
2. Debuggers. For browsers, we'd like a suite of tests that can run wherever browsers apply source maps to their debug tools like Chrome DevTools. We'd like generic tests that browsers can use showing they apply source maps correctly. My assumption is they each already have their own suite of tests ([Chrome tests](https://github.com/ChromeDevTools/devtools-frontend/blob/main/test/e2e/sources/sourcemap_test.ts), [Firefox tests](https://github.com/mozilla/source-map/tree/master/test)) for this and we'll need to figure out how to integrate with their test harness and extract a shared base of tests we all could use. For stack trace rewriters, we'd like tests that can show source maps being correctly applied to error stacks.

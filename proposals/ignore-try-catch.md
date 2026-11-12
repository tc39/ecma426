# Ignoring some `try`/`catch` for "pause on uncaught exceptions"

## Current Status

Source maps proposal at stage 1 of the process, see [Our process document](https://github.com/tc39/source-map/blob/main/PROCESS.md)

* Stage: 1
* Author: Nicolò Ribaudo
* Date: October, 2026

Stage 1 was reached at the [October 14, 2026 TG4 meeting](https://docs.google.com/document/d/1a6Cg0E_Ba8wZe6wVb8NHY_p3akU3CnabkxuK6LmPR3c/edit?tab=t.0) ([slides](https://docs.google.com/presentation/d/1QLqBm2lkX0rHh00p0mKYS7D8UPQLFpqYxk9ouvxi38o/)).

## Motivation

Debuggers commonly offer a "pause on uncaught exceptions" option: when an exception is thrown and there is nothing on the stack that will catch it, the debugger pauses at the `throw` statement.

To decide whether an exception is uncaught, debuggers check whether there is any `try`/`catch` on the stack that would handle it. However, it's common for library code or transpiled code to have try-catch-rethrow patterns, where from the developer's perspective the exception is still uncaught. In those cases, the debugger currently pauses at the place where the error is re-thrown, which is far away from where the error originally happened.

This problem has come up in the context of the [AsyncContext proposal](https://github.com/tc39/proposal-async-context), which encourages telemetry libraries to follow patterns that rely heavily on `try`/`catch`/`finally`.

### Example: transpilation of `using` declarations

Consider this code:

```js
function functionThatThrows() {
  const value = 42;
  throw new Error(`boom (${value})`);
}

function withUsing() {
  using res = createResource();
  functionThatThrows();
}
```

When running `withUsing()` with "pause on uncaught exceptions" enabled, the debugger pauses at `throw new Error(...)`, where the developer can see that `value` is `42`.

However, when `using` is transpiled (for example, by Babel), the code becomes similar to this:

```js
function functionThatThrows() {
  const value = 42;
  throw new Error(`boom (${value})`);
}

function withUsing() {
  try {
    var _usingCtx = _usingCtx2();

    const res = _usingCtx.u(createResource());
    functionThatThrows();

  } catch (_) {
    _usingCtx.e = _;
  } finally {
    _usingCtx.d();
  }
}
```

The error is now caught by the `catch (_)` block, stored, and re-thrown by the `_usingCtx.d()` helper after disposing the resources.
When running `withUsing()`, the debugger now pauses inside Babel's `_usingCtx.d()` helper rather than at the original `throw`.

Babel's transpilation, which preserves the original semantics of the code, changed its debugging experience.

### Example: telemetry libraries

The same problem happens without any transpilation. Consider an HTTP server whose request handler throws:

```js
httpServer((request) => {
  throw new Error("unhandled error!");
});
```

The error is uncaught, and the debugger pauses at the `throw`. Now, let's wrap the handler with a tracing span from a telemetry library:

```js
httpServer((request) => startSpan(() => {
  throw new Error("unhandled error!");
}));
```

```js
function startSpan(callback) {
  currentSpan = new Span(currentSpan);
  try {
    return callback();
  } catch (err) {
    currentSpan.recordException(err);
    throw err;
  } finally {
    currentSpan = currentSpan.end();
  }
}
```

The error is not uncaught anymore from the debugger's point of view, because `startSpan` catches it (only to record it and immediately re-throw it). Adding the telemetry library to `ignoreList` (which should happen, given that it's a dependency from `node_modules`) has no effect on the "break on uncaught exceptions" behavior.

Adding telemetry to an application should not change how the developer experiences errors while debugging.

## Goals

We need a way to mark some `try`/`catch` statements so that they are ignored when the debugger checks whether an exception is handled or not, so that "pause on uncaught exceptions" pauses at the original `throw` site.

This information needs to be expressible both by:
* tools that generate code (transpilers, bundlers), for `try`/`catch` statements they introduce, and
* library authors, for `try`/`catch` statements they write by hand in their source code and that are not necessarily processed by any build tool before being published.

## Possible solutions

One possible approach is to encode this information on top of the [scopes proposal](./scopes.md). We can mark the scope of a `try` block as "not actually catching", and the "pause on uncaught exceptions" logic would then ignore exceptions caught by such scopes. Transpilers would then just need to emit the relevant flag in that scope.

For the case of hand-authored libraries, we can coordinate with tools to introduce a new magic comment to put in front of the `try` statement. When bundling/minifying/transpiling, tools could then convert that comment into information in the source map.

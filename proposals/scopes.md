# Proposal for adding information about scopes and their bindings to source maps

* **Prototype**: https://github.com/hbenl/tc39-proposal-scope-mapping/
* **Related**: https://github.com/tc39/source-map-rfc/blob/main/proposals/env.md

Discussion of this proposal is placed at [#37](https://github.com/tc39/source-map-rfc/issues/37)

## Current Status

Source maps proposal at stage 3 of the process, see [Our process document](https://github.com/tc39/source-map/blob/main/PROCESS.md)

## Author

Holger Benl
Simon Zünd

## Abstract

This document describes an extension to the [source map format](https://tc39.es/source-map-spec/) for encoding scopes and bindings information to improve the debugging experience.
There is [another proposal](https://github.com/tc39/source-map-rfc/blob/main/proposals/env.md) that is also trying to solve the same problem, but it includes less information about the scopes and hence doesn't support all scenarios that this proposal supports, like dealing with inlined functions or variable shadowing that was introduced by minification.

## Motivation/use cases

Currently source maps enable a debugger to map locations in the generated source to corresponding locations in the original source. This allows the debugger to let the user work with original sources when adding breakpoints and stepping through the code. However, this information is generally insufficient to reconstruct the original frames, scopes and bindings:
- when the debugger is paused in a function the was inlined, the stack doesn't contain a frame for the inlined function but the debugger should be able to reconstruct that frame
- the debugger should be able to reconstruct scopes that were removed by the compiler
- the debugger should be able to hide scopes that were added by the compiler
- when a variable was renamed in the generated source, the debugger should be able to get its original name; this is possible with the current source maps format by looking for mappings that map the declaration of a generated variable to one of an original variable and optionally using the `names` array, but this approach requires parsing the sources, is hard to implement and experience shows that it doesn't work in all situations
- the debugger should be able to reconstruct original bindings that have no corresponding variables in the generated source
- the debugger should be able to hide generated bindings that have no corresponding variables in the original source
- it should be possible to find the original function names for frames in a stack trace

#### Use cases:

1. Defining boundaries of inline functions

With the defined information about scopes and their types, it's possible to define boundaries of inline functions.
So, for the case like the next one:
```js
// Example is inspired by https://github.com/bloomberg/pasta-sourcemaps

// Before inlining
const penne     = () => { throw Error(); }
const spaghetti = () => penne();
const orzo      = () => spaghetti();
orzo();

// After inlining
throw Error()
```
With the encoded environment it becomes possible to:
- Reconstruct the stack trace with the original function names for the `Error` 
- Have `Step Over` and `Step Out` actions during the debugging for the inlined functions

2. Debugging folded or erased variables

Also, with the encoded information about variables in the original scopes debugger can reconstruct folded and erased variables and their values.
The first example is taken from the [discussion](https://github.com/tc39/source-map-rfc/issues/2#issuecomment-74966399) and it's an example of a possible way to compile Python comprehension into JS:
```python
# source code
result = [x + 1 for x in list]
```
```js
// compiled code
var result = [];
for (var i = 0; i < list.length; i++) {
    // Note: no `x` binding in this generated JS code.
    result.push(list[i] + 1);
}
```
With the encoded scopes we can include the information about the `x` binding and "map" it on the `list[i]` expression

The second example is related to code compression tools such as [terser](https://github.com/terser/terser) or [google/closure-compiler](https://github.com/google/closure-compiler).
For the next code snippet:
```js
// Before the compression
const a = 3
const b = 4
console.log(a + b)

// After the compression
console.log(7)
```
With the encoded bindings of `a` and `b` constants, it's also possible for the debugger to reconstruct and give the ability to explore folded constants.

3. Customizing representation of the internal data structures

Also, it's possible to post-process values during the debug process to show to the end user a "more eloquent" representation of different values.
One of the examples is representing new JS values in browsers that still do not support them. Imagine that the `bigint` is still not supported.
In this case, for the next code snippet:
```js
// https://github.com/GoogleChromeLabs/jsbi
const a = JSBI.BigInt(Number.MAX_SAFE_INTEGER) // JSBI [1073741823, 8388607]
```

It's possible to encode the `a` binding and put as a value an expression that converts the `JSBI [1073741823, 8388607]` into at least a string like `"BigInt(9007199254740991)"` that helps more during a debug process.

Also, such post-processing could include hiding unnecessary properties from objects.

## Detailed design

The sourcemap should include information for every scope in the generated source and every scope in the original sources that contains code which appears in the generated source.
More precisely, for every location `loc_gen` in the generated code that is mapped to `loc_orig` in the original code:
- the generated scopes described in the sourcemap which contain `loc_gen` should be exactly the scopes in the generated source which contain `loc_gen`
- the original scopes described in the sourcemap which contain `loc_gen` should be exactly
  - the scopes in the original source which contain `loc_orig` and
  - if `loc_gen` is in an inlined function, the scopes in the original source which contain the function call that was inlined

The following information describes a scope in the source map:
- whether this is a function scope
- whether bindings from outer scopes are accessible within this scope
- whether the debugger should step over this scope
- whether this scope should be shown among the original scopes
- the start and end locations of the scope in the generated source
- an optional name (the original name of the function for function scopes)
- optionally the start and end locations of the scope in the original source
- only for scopes representing an inlined function: the location of the function call (the callsite)
- the scope's bindings, for each binding we add
  - the original variable name
  - a javascript expression that can be evaluated by the debugger in the corresponding generated scope to get the binding's value (if such an expression is available)

The following code snippet specifies the scope information **conceptually** in TypeScript notation. See the [Encoding](#encoding) section
on how this information is actually VLQ encoded. We chose the name `GeneratedRange` instead of `GeneratedScope` to make it explicit that a `GeneratedRange` does not necessarily correspond to a lexical ECMAScript scope (e.g. in the case of an inlined function body).

```ts
interface SourceMap {
  // ...
  originalScopes?: OriginalScope[];
  generatedRanges?: GeneratedRange;
}

interface OriginalScope {
  start: OriginalPosition;
  end: OriginalPosition;
  /** Serves as a label in source-map consumers */
  kind?: string;
  /** Class/module/function name. Can be used for stack traces or naming scopes in a debugger's scope view */
  name?: string;
  /**
   * Whether this scope corresponds to the semantic equivalent of a function call in
   * the authored language, and as such can show up in stack traces.
   */
  isStackFrame: boolean;
  /** Symbols defined in this scope */
  variables?: string[];
  children?: OriginalScope[];
}

interface GeneratedRange {
  start: GeneratedPosition;
  end: GeneratedPosition;
  /**
   * Whether this range is a JavaScript function/method/generator/constructor and can show
   * up in Error.stack as a stack frame.
   */
  isStackFrame: boolean;
  /**
   * Whether calls to this range should be removed from stack traces.
   * Intended for outlined functions or transpiler inserted function that correspond
   * to an original scope, but should be hidden from stack traces (e.g. an original block
   * scope outlined into a function).
   */
  isHidden: boolean;
  originalScope?: OriginalScope;
  /** If this scope corresponds to an inlined function body, record the callsite of the inlined function in the original code */
  callsite?: OriginalPosition;
  /**
   * Expressions that compute the values of the variables of this OriginalScope. The length
   * of `values` must match the length of `originalScope.variables`.
   *
   * For each variable this can either be a single expression (valid for the full `GeneratedRange`),
   * or an array of `BindingRange`s, e.g. if computing the value requires different expressions
   * throughout the range or if the variable is only available in parts of the `GeneratedRange`.
   */
  bindings?: (string | undefined | BindingRange[])[];
  children?: GeneratedRange[];
}

interface BindingRange {
  from: GeneratedPosition;
  to: GeneratedPosition;
  expression?: string;
}

interface GeneratedPosition {
  line: number;
  column: number;
}

interface OriginalPosition {
  sourceIndex: number;
  line: number;
  column: number;
}
```

### Encoding

We introduce two new fields "scopes" and "expressions" to the source map JSON:

  * "scopes" is a string. It contains a list of comma-separated items. Each item is prefixed with a unique "tag". The items themselves build a tree structure that describe "original scope" and "generated range" trees.
  * "expressions" is an array of strings. It is similar to "names" and serves as a string table for JavaScript expressions. `null` is a valid value in this string array and is used to signify that variables are unavailable.

The format of "scopes" is presented in an EBNF-like grammar, with:

  * Three terminals: Signed, unsigned VLQ and comma '`,`'. VLQ terminals are labelled and we denote them with UPPERCASE.
    We prefix the terminal with `u` or `s` to signify an unsigned or signed VLQ respectively. E.g. the terminal `uLINE` signifies
    an unsigned VLQ labelled `LINE`.
  
  * Non-terminals are denoted with `snake_case`.

  * `symbol?` means zero or one `symbol`.
  * `symbol+` means one or more `symbol`.

The start symbol is `scopes`:

```
scopes := item_list

item_list :=
    top_level_item
  | top_level_item ',' item_list

top_level_item :=
    original_scope_tree
  | generated_range_tree
```

The recommendation is to use one top-level `original_scope_tree` per `sources` file, but multiple are technically allowed.
Multiple top-level `generated_range_tree`s are also allowed, this is especially useful when multiple bundles are straight-up
concatenated.


#### Original Scope Trees

```
original_scope_tree :=
  original_scope_start
  original_scope_variables?
  original_scope_source_index?
  original_scope_tree?
  original_scope_end
```

A scope is delineated by a `original_scope_start` and a `original_scope_end` item. The `original_scope_variables` and `original_scope_source_index`
item always describe the immediately "surrounding" start/end pair.

```
original_scope_start :=
  'B'     // Tag: 0x1 unsigned
  uFLAGS
  uLINE
  uCOLUMN
  sNAME?  // Present if FLAGS<0> is set.
  sKIND?  // Present if FLAGS<1> is set.

original_scope_variables :=
  'D'        // Tag: 0x3 unsigned
  sVARIABLE+

original_scope_source_index :=
  'E'    // Tag: 0x4 unsigned
  uINDEX

original_scope_end :=
  'C'     // Tag: 0x2 unsigned
  uLINE
  uCOLUMN
```

The encoding scheme supports two different ways to connect a top-level `original_scope_tree` with a specific source file:

  1) Use a `original_scope_source_index` item. It's `uINDEX` is an index into the `sources` array.
  2) If `scopes` contains exactly N top-level `original_scope_trees` where N is the length of the `sources` array, then the `i`th
     `original_scope_tree` describes `sources[i]`.

The `uFLAGS` field in `original_scope_start` is a bit field defined as follows:
  * 0x1 has name
  * 0x2 has kind
  * 0x4 is stack frame

`original_scope_variables` is a list of indices into the `names` array of the source map JSON. The list describes the original names
of the scope's variables.

To reduce the number of bytes required to encode the "scopes" information, we use relative values where possible:

  * `sNAME` in `original_scope_start` is relative to the previous occurrence of `sNAME` (or absolute for the first).
  * `sKIND` in `original_scope_start` is relative to the previous occurrence of `sKIND` (or absolute for the first).
  * `uLINE` in `original_scope_start` and `original_scope_end` are relative to the previous occurrence (or absolute for the first).
    This means a `uLINE` of a `original_scope_start` is relative to either its parents' start line or its preceding siblings' end line.
  * `sVARIABLE` in `original_scope_variables` is relative to the previous occurrence of `sVARIABLE` (or absolute for the first).

Each top-level `original_scope_tree` resets the "relative state". That is, each top-level `original_scope_tree` is decoded as if its the first.


#### Generated Range Trees

```
generated_range_tree :=
  generated_range_start
  generated_range_callsite?
  generated_range_bindings?
  generated_range_subrange_binding?
  generated_range_tree?
  generated_range_end
```

Similar to "original scopes", a generated range is delineated by a `generated_range_start` and `generated_range_end`. Any other item describes the range
corresponding to the immediately surrounding start/end pair.

```
generated_range_start :=
  'F'     // Tag: 0x5 unsigned
  uFLAGS
  uCOLUMN
  uLINE?       // Present if FLAGS<0> is set.
  sDEFINITION? // Present if FLAGS<1> is set.

generated_range_end :=
  'G'    // Tag: 0x6 unsigned
  uCOLUMN
  uLINE?
```

Since bundles tend to consist of a single line (or very few lines), `generated_range_start` and `generated_range_end` omit the line by default.

The `uFLAGS` field in `generated_range_start` is a bit field defined as follows:
  * 0x1: has line
  * 0x2: has definition
  * 0x4: is stack frame
  * 0x8: is hidden

Similar to "original scopes", we use relative numbers to reduce the bytes required:

  * `uLINE` in `generated_range_start` and `generated_range_end` are relative to the previous occurrence (or absolute for the first).
  * `uCOLUMN` in `generated_range_start` and `generated_range_end` are relative to the previous occurrence, if the previous start/end item is on the same line. Absolute otherwise.
  * `sDEFINITION` in `generated_range_start` is relative to the previous occurrence (or absolute for the first).

`sDEFINITION` is an index into the list of `original_scope_start` items. If `definitionIdx` is the resolved value, then the corresponding `original_scope_start` could
be found with the pseudo code `const scopeStart = scopes.filter(item => item.tag === 'B')[definition]`.

```
generated_range_callsite :=
  'J'         // Tag: 0x9 unsigned
  sSOURCE_IDX
  sLINE
  sCOLUMN
```

If a "generated range" contains a callsite, then the range describes an inlined function body. The inlined function was called at the original position described by this `generated_range_callsite`.

  * `sSOURCE_IDX` in `generated_range_callsite` is relative to the previous occurrence (or absolute for the first).
  * `sLINE` in `generated_range_callsite` is relative to the previous occurrence, if the previous `generated_range_callsite` was in the same source file. Absolute otherwise.
  * `SCOLUMN` in `generated_range_callsite` is relative to the previous occurrence, if the previous `generated_range_callsite` was on the same line in the same file. Absolute otherwise.

```
generated_range_bindings :=
  'H'       // Tag: 0x7 unsigned
  sBINDING+ 
```

`generated_range_bindings` are only valid for generated ranges that have a `sDEFINITION`. The bindings list must be equal in length as the variable list of the original scope the `sDEFINITION` references. `sBINDING+` is a list of indices into the `"expressions"` field of the source map JSON. Each binding is a JavaScript expression that, when evaluated, produces the **value** of the corresponding variable.

`sBINDING+` indices are encoded relative to each other. To signify that a variable is unavailable, it is valid to put the JavaScript value `null` into the `"expressions"` array and point to that.

```
generated_range_subrange_binding :=
  'I'             // Tag: 0x8 unsigned
  uVARIABLE_INDEX
  binding_from+

binding_from :=
  sBINDING
  uLINE
  uCOLUMN
```

A variable might not be available through the full generated range, or a different expression is required for parts of the generated range to retrieve a variables value. In this case a generator can use `generated_range_subrange_binding` to encode this.

  * `uVARIABLE_INDEX` is an index into the corresponding original scopes' variables list. It is encoded relative inside a generated range.
  * `binding_from` are the sub-ranges. The initial value expression for a variable is provided by the `generated_range_bindings` item. The generated position in `binding_from` is the start from which the expression `sBINDING` from `binding_from` needs to be used to retrieve the variables value instead.
  * `sBINDING` is an index into the `"expressions"` field in the source map JSON. It is relative to previous occurrences (also relative to the last `sBINDING+` in `generated_range_bindings`)
  * `uLINE` is relative to the generated range's start line for the first `generated_range_subrange_binding` for a specific variable. Or relative to the previous subrange `uLINE` of the same variable.
  * `uCOLUMN` is relative to the `binding_from`/`generated_range_start` `uCOLUMN` if the line of this subrange is the same as the line of the preceding `binding_from`/`generated_range_start` or absolute otherwise.

### Example

Original Code (file.js):

``` js
var x = 1;
function z(message) {
  let y = 2;
  console.log(message + y);
}
z("Hello World");
```

Generated Code:

``` js
var _x = 1;
function _z(_m) {
  let _y = 2;
  console.log(_m + _y);
}
console.log("Hello World2"); // <- Inlined
```

Original Scopes:

```
A|   var x = 1;
 |B| function z(message) {
 | |   let y = 2;
 | |   console.log(message + y);
 | | }
 |   z("Hello World");
```

`LX CY`: Line X Column Y

```
Start Original Scope L0 C0 { // A
  kind: global
  field flags: has kind
  name: none
}
Variables [x, z]
Start Original Scope L1 C10 { // B
  kind: function
  field flags: has name, has kind, is stack frame
  name: z
}
Variables [message, y]
End Original Scope L4 C1  // B
End Original Scope L5 C17 // A
```

Generated Ranges:

```
A|    var _x = 1;
 | B| function _z(_m) {
 |  |   let _y = 2;
 |  |   console.log(_m + _y);
 |  | }
 | C| console.log("Hello World2");
```

`LX CY`: Line X Column Y

```
Start Generated Range C0 { // A
  field flags: has definition
  definition: scope start 0
}
Bindings [x -> _x, z -> _z]
Start Generated Range C16 { // B
  field flags: has definition, is stack frame
  definition: scope start 1
}
Bindings [message -> _m, y -> _y]
End Generated Range C1 // B
Start Generated Range C0 { // C
  field flags: has definition, has callsite
  definition: scope start 1
}
Bindings [message -> "Hello World", y -> 2]
Callsite file.js L5 C0
End Scope C28 // C
End Scope C28 // A
```

## Questions

WORK IN PROGRESS

## Related Discussions

- [Scopes and variable shadowing](https://github.com/tc39/source-map-rfc/issues/37)
- [Include record of inlined functions](https://github.com/tc39/source-map-rfc/issues/40)
- [Improve function name mappings](https://github.com/tc39/source-map-rfc/issues/33)
- [Encode scopes and variables in source map](https://github.com/tc39/source-map-rfc/issues/2)
- [Proposal: Source Maps v4 (or v3.1): Improved post-hoc debuggability](https://github.com/tc39/source-map-rfc/issues/12)


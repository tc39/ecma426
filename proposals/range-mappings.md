# Range Mappings

Draft spec: https://tc39.es/ecma426/branch/proposal-range-mappings/

## Current Status

Source maps proposal at stage 2 of the process, see [Our process document](https://github.com/tc39/source-map/blob/main/PROCESS.md)

## Author

* Stage: 2
* Author: Asumu Takikawa, Tobias Koppers
* Date: November, 2023

## Motiviation

Currently mappings map locations in the source code to other locations in the source code.
This works well when trying to access a location that is defined in the SourceMap, but one loses precision when accessing locations that are not directly defined in the SourceMap.
In these cases tools usually fallback to next lower column that is actually mapped in the SourceMap.
So we are either losing information or we need many mappings in the SourceMap to cover all possible locations.

These information problem is especially problematic when applying a SourceMap to another SourceMap.
Here we can only use locations that are specified in both SourceMaps. We have to be lucky that locations match up.

### Practical example

As an example let's look at a build process when a TypeScript file is converted to JavaScript first and that is minified afterwards.

A simplistic TypeScript to JavaScript transformation such as SWC's [`strip_types`](https://play.swc.rs/?version=1.10.7&code=H4sIAAAAAAAAA0WMQQqDMBBF93OKv6wgPYBpu5HewAvEQTA0Tcpkggvx7k2E4OrD%2B4%2FH3qaE0epjemEn4Jdn7xjb6tJnkTQg5O%2B8iLkutc4PmAwVxDEklcwa5cYxB21%2B37TurAJagvdWxROnba6r6gXXqfSgg0hXiRveIqXemT8eTB9GqwAAAA%3D%3D&config=H4sIAAAAAAAAA1VPOw7DIAzdOQXy3KFi6NA79BCIOhERAYQdqSjK3QsJpM1mv4%2Ff8yqkhIkMPOVaxrJEnQjTuReEsmf9KQhwjkgm2chw6yxTpQbtCHdoOxhgnUbk6kJSd6WaA1wIhN3RsNl6O%2BT%2FTBPmmJDoKqxS7UeH10TRUmEO72Un2y%2B179HgAT9RDzsPg6VXd3JaUGxfBMLf3xcBAAA%3D&strip-types=) keeps the runtime code identical, whilst removing type annotations.
Theoretically only a few SourceMap mappings are needs, as most code stays identical.

Minifying is a bigger transformation of the code, which one it's own would result in a lot of SourceMap mappings to be generated.

When both build steps are applied in a pipeline, this would result in a SourceMap with a coarse granularity since it could only map points that are defined in the TypeScript and the minifier SourceMap.

With this proposal the TypeScript SourceMap could use range mappings to describe code that is kept identical in the TypeScript transformation. This would result in a fine granularity of the final SourceMap as described in the SourceMap produced from the minifier.

The TypeScript SourceMap would behave identical to a SourceMap mapping every single char of the generated code, but without the need for more mappings in the SourceMap.

## Proposal

Add a boolean flag for each mapping to convert it into a "range mapping".
For a range mapping, tools should assume that every char (including newlines) that follows the mapping (until the next mapping), is mapped to the specified original location plus the offset in the generated code.
This means all chars in the generated code that is covered by the range mapping, are mapped char by char to the same range in the original code.
(Usually this only makes sense when generated and original are identical for that range)

### Example

Generated Code:

``` js
console.log(
"hello world");
```

Original Code:

``` js
// Copyright 2023
  console.log(
"hello world");
```

With a normal mapping:

```
Source Map:
Generate Line 1 Column 0 -> Original Line 2 Column 2
Generate Line 2 Column 0 -> Original Line 3 Column 0
```

``` js
console.log(\n"hello world");
^       ^     ^
|       |     + maps to Original Line 3 Column 0
|       + maps to Original Line 2 Column 2
+ maps to Original Line 2 Column 2
```

With a range mapping:

```
Source Map:
Generate Line 1 Column 0 -> Original Line 2 Column 2 (range mapping)
```

``` js
console.log(\n"hello world");
^       ^     ^
|       |     + maps to Original Line 3 Column 0
|       + maps to Original Line 2 Column 10
+ maps to Original Line 2 Column 2
```

### Encoding

To avoid a breaking change to the `mappings` field, a new field named `rangeMappings` is added.
It contains encoded data per-line in the generated code.
Each line is separated by `;`.
The data contains a sequence of unsigned VLQs. Each VLQ encodes a relative offset to the next
zero-based index in the mappings of that line that is a range mapping. Mappings that are not
explicitly marked by these offsets are normal mappings and are not range mappings.

```
"rangeMappings": "ABCgB;;B"
```

decodes as:

```
Line 1: 0b000000 0b000001 0b000010 0b100000 0b000001 => 0 1 2 32 => the 1st, 2nd, 4th, and 36th mappings are range mappings
Line 3: 0b000001 => 1 => the 2nd mapping is a range mapping
```

> Note: The per-line encoding is chosen to make it easier to generate SourceMap line by line.
> It also looks similar to the `mappings` field, so should allow good compression.

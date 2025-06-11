# Proposal to add hashes for "sources"

## Current Status

Source maps proposal at stage 1 of the process, see [Our process document](https://github.com/tc39/source-map/blob/main/PROCESS.md)

## Author

Simon Zünd


## Motivation

Modern debugging workflows frequently encounter scenarios where the same "original source" URL appears in multiple source maps. Determining whether these URLs refer to identical source files presents a challenge. When the optional `"sourcesContent"` field is present in both source maps, this comparison is straightforward. However, many source maps omit `"sourcesContent"` to reduce file size. In such cases, debuggers are forced to fetch the content of the original source file(s) to ascertain their identity, leading to unnecessary network requests and increased debugging overhead.

This issue is particularly prevalent in modern web development practices:

* With Code Splitting, common source files (e.g., `shared.ts`) can be included in multiple bundles. Debuggers need an efficient way to recognize that these instances refer to the same underlying file without redundant fetches.
* With Hot Module Replacement (HMR), development servers often serve different versions of the same `"foo.ts"` file over time, even when referenced from the same source map. Debuggers could significantly optimize their behavior by skipping unnecessary processing when they can reliably determine that a source file's content has not changed across HMR updates.

For the *generated file*, a similar problem is addressed by the [Debug ID proposal](./debug-id.md), which provides a unique identifier for the generated code. A comparable mechanism would be advantageous original source files.

## Proposal

We propose the addition of a new optional field, `"sourcesHash"`, to the ECMA-426 Source Map specification. This field would be an array, where each entry corresponds to an entry in the `"sources"` array and contains an implementation-defined hash of the original source file's content.

The `"sourcesHash"` field would enable debuggers and other tooling to quickly and reliably determine if two "original source" URLs refer to the same file content without needing to fetch the actual source content, thereby improving debugging efficiency and reducing network load.


### Example

```json
{
  "version": 3,
  "file": "bundle.js",
  "sources": [
    "src/foo.ts",
    "src/bar.ts"
  ],
  "sourcesHash": [
    "sha256-abc123...",
    "sha256-def456..."
  ],
  "mappings": "...",
  "names": []
}
```


## Considerations

* The specific hashing algorithm used should be implementation-defined to allow for flexibility and future-proofing. However, the specification could recommend or provide guidance on suitable algorithms (e.g., SHA-256) for interoperability.
* The representation of the hash should be clearly defined. It could be an opaque string or the base64 encoded binary hash.